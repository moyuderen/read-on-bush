import fs from 'fs';
import path from 'path';
import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type {
  ChapterRef,
  EpubChapter,
  EpubExtraction,
  EpubImage
} from '../../domain/books';
import { normalizeCjkSpacing, normalizeCjkSpacingWithOffsetMap } from './TextNormalization';

export type { EpubChapter, EpubExtraction, EpubImage };

/** 把提取结果映射成书架树展示用的章节引用（导入/打开时复用同一份逻辑）。 */
export function toChapterRefs(extraction: EpubExtraction): ChapterRef[] {
  return extraction.chapters.map((chapter) => ({ title: chapter.title }));
}

type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
  zipPath: string;
};

type ExtractionContext = {
  text: string;
  images: EpubImage[];
  firstHeading: string | undefined;
};

type ContentNode = Record<string, unknown>;
type AttrMap = Record<string, string>;

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'blockquote',
  'li',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'br',
  'tr',
  'table',
  'td',
  'th',
  'thead',
  'tbody',
  'header',
  'footer',
  'nav',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'pre',
  'address'
]);

const SKIP_TAGS = new Set(['head', 'style', 'script', 'title', 'meta', 'link', 'noscript']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// OPF / NCX / nav 这类结构化文档用对象形态，便于按字段查找
const structParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  processEntities: true
});

// XHTML 正文用顺序形态，便于按文档顺序累积文本与图片锚点
const contentParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  preserveOrder: true,
  processEntities: true,
  trimValues: false
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeZipPath(raw: string): string {
  const stripped = raw.replace(/^\.\//, '').replace(/^\//, '');
  const parts: string[] = [];
  for (const seg of stripped.split('/')) {
    if (seg === '.' || seg === '') {
      continue;
    }
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
}

function decodeHrefPath(href: string): string {
  const hrefPath = href.split('#')[0];
  return hrefPath
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
}

function resolveZipPath(baseDir: string, href: string): string {
  return normalizeZipPath(path.posix.join(baseDir, decodeHrefPath(href)));
}

class ZipReader {
  private readonly entries: Map<string, Uint8Array>;
  private readonly lowerKeys: Map<string, string>;

  constructor(buffer: Uint8Array) {
    const unzipped = unzipSync(buffer);
    this.entries = new Map();
    this.lowerKeys = new Map();
    for (const [key, value] of Object.entries(unzipped)) {
      const normalized = normalizeZipPath(key);
      if (normalized === '') {
        continue;
      }
      this.entries.set(normalized, value);
      this.lowerKeys.set(normalized.toLowerCase(), normalized);
    }
  }

  read(relPath: string): string | undefined {
    const normalized = normalizeZipPath(relPath);
    const direct = this.entries.get(normalized);
    if (direct) {
      return new TextDecoder('utf-8').decode(direct);
    }
    const lowered = this.lowerKeys.get(normalized.toLowerCase());
    if (lowered) {
      return new TextDecoder('utf-8').decode(this.entries.get(lowered)!);
    }
    return undefined;
  }

  readBytes(relPath: string): Uint8Array | undefined {
    const normalized = normalizeZipPath(relPath);
    const direct = this.entries.get(normalized);
    if (direct) {
      return direct;
    }
    const lowered = this.lowerKeys.get(normalized.toLowerCase());
    return lowered ? this.entries.get(lowered) : undefined;
  }
}

function appendText(ctx: ExtractionContext, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }
  const normalized = value.replace(/\s+/g, ' ');
  if (!normalized) {
    return;
  }
  if (normalized === ' ' && (ctx.text === '' || ctx.text.endsWith('\n'))) {
    return;
  }
  ctx.text += normalized;
}

function breakParagraph(ctx: ExtractionContext): void {
  // 段落末尾去空白，保证图片锚点 charOffset 与最终章节文本坐标一致
  ctx.text = ctx.text.replace(/[^\S\n]+$/, '');
  if (ctx.text && !ctx.text.endsWith('\n')) {
    ctx.text += '\n';
  }
}

function getAttribute(attrs: AttrMap | undefined, names: string[]): string | undefined {
  if (!attrs) {
    return undefined;
  }
  for (const name of names) {
    const value = attrs[name];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return undefined;
}

function recordImage(
  ctx: ExtractionContext,
  tag: string,
  attrs: AttrMap | undefined,
  chapterDir: string,
  manifest: Map<string, ManifestItem>
): void {
  // removeNSPrefix 后 xlink:href / href 统一为 href
  const href = getAttribute(attrs, ['@_src', '@_href', '@_xlink:href']);
  if (!href) {
    return;
  }
  const zipPath = resolveZipPath(chapterDir, href);
  const manifestItem = findManifestByPath(manifest, zipPath);
  ctx.images.push({
    zipPath,
    mediaType: manifestItem?.mediaType || guessImageMediaType(tag, zipPath),
    charOffset: ctx.text.length
  });
}

function findManifestByPath(
  manifest: Map<string, ManifestItem>,
  zipPath: string
): ManifestItem | undefined {
  const normalized = normalizeZipPath(zipPath);
  for (const item of manifest.values()) {
    if (item.zipPath === normalized) {
      return item;
    }
  }
  return undefined;
}

/** 支持内联查看的图片扩展名 → MIME 映射（抽取与看图面板共用同一份）。 */
export const IMAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

export const SUPPORTED_IMAGE_MEDIA_TYPES: ReadonlySet<string> = new Set(
  Object.values(IMAGE_MEDIA_TYPES)
);

function guessImageMediaType(tag: string, zipPath: string): string {
  const ext = path.extname(zipPath).toLowerCase();
  if (ext === '.svg' || tag === 'image') {
    return IMAGE_MEDIA_TYPES[ext] || 'image/svg+xml';
  }
  return IMAGE_MEDIA_TYPES[ext] || 'application/octet-stream';
}

function walkContent(
  nodes: ContentNode[] | ContentNode | unknown,
  ctx: ExtractionContext,
  chapterDir: string,
  manifest: Map<string, ManifestItem>
): void {
  const list = asArray(nodes as ContentNode[] | ContentNode);
  for (const node of list) {
    if (!node || typeof node !== 'object') {
      appendText(ctx, node);
      continue;
    }

    // 文本节点
    if (typeof node['#text'] === 'string') {
      appendText(ctx, node['#text']);
      continue;
    }

    // 元素节点：preserveOrder 形态下只有一个标签键（外加可选 ':@'）
    const attrs = (node[':@'] as AttrMap | undefined) ?? undefined;
    let tagKey: string | undefined;
    for (const key of Object.keys(node)) {
      if (key === ':@' || key === '#text') {
        continue;
      }
      tagKey = key;
      break;
    }

    if (!tagKey) {
      continue;
    }

    if (SKIP_TAGS.has(tagKey)) {
      continue;
    }

    const children = asArray(node[tagKey] as ContentNode[] | ContentNode);

    if (tagKey === 'img' || tagKey === 'image') {
      recordImage(ctx, tagKey, attrs, chapterDir, manifest);
      // 图片不递归子节点
      continue;
    }

    if (HEADING_TAGS.has(tagKey) && ctx.firstHeading === undefined) {
      const before = ctx.text.length;
      walkContent(children, ctx, chapterDir, manifest);
      const heading = ctx.text.slice(before).trim();
      if (heading) {
        ctx.firstHeading = heading;
      }
      continue;
    }

    if (BLOCK_TAGS.has(tagKey)) {
      breakParagraph(ctx);
    }

    walkContent(children, ctx, chapterDir, manifest);

    if (BLOCK_TAGS.has(tagKey)) {
      breakParagraph(ctx);
    }
  }
}

function extractChapterText(
  xhtml: string,
  chapterDir: string,
  manifest: Map<string, ManifestItem>
): { text: string; images: EpubImage[]; firstHeading: string | undefined } {
  const parsed = contentParser.parse(xhtml) as ContentNode[];
  const ctx: ExtractionContext = { text: '', images: [], firstHeading: undefined };
  walkContent(parsed, ctx, chapterDir, manifest);
  // 不做按行 trim/过滤：上方 breakParagraph 已保证段落无首尾空白。
  // CJK 空格归一化会改变文本长度，因此同步映射图片锚点，保持 charOffset 与最终文本坐标一致。
  const leadingTrimmed = ctx.text.length - ctx.text.trimStart().length;
  const rawText = ctx.text.trim();
  const normalized = normalizeCjkSpacingWithOffsetMap(rawText);
  const images = ctx.images.map((image) => ({
    ...image,
    charOffset: normalized.mapOffset(image.charOffset - leadingTrimmed)
  }));
  const firstHeading = ctx.firstHeading ? normalizeCjkSpacing(ctx.firstHeading) : undefined;
  return { text: normalized.text, images, firstHeading };
}

function parseContainerOpfPath(containerXml: string): string | undefined {
  const parsed = structParser.parse(containerXml) as ContentNode;
  const container = (parsed.container as ContentNode | undefined) ?? {};
  const rootFiles = (container.rootfiles as ContentNode | undefined) ?? {};
  const rootFile = asArray(rootFiles.rootfile as ContentNode[] | ContentNode)[0];
  const fullPath = getAttribute(rootFile as AttrMap | undefined, ['@_full-path', '@_fullPath']);
  return fullPath ? normalizeZipPath(fullPath) : undefined;
}

function parseManifestAndSpine(opfXml: string, opfDir: string): {
  bookTitle: string;
  manifest: Map<string, ManifestItem>;
  spine: string[];
  tocId: string | undefined;
} {
  const parsed = structParser.parse(opfXml) as ContentNode;
  const pkg = (parsed.package as ContentNode | undefined) ?? {};
  const metadata = (pkg.metadata as ContentNode | undefined) ?? {};
  const bookTitle =
    (typeof metadata.title === 'string' ? metadata.title : undefined) ?? '未知书名';

  const manifestNode = (pkg.manifest as ContentNode | undefined) ?? {};
  const manifest = new Map<string, ManifestItem>();
  for (const item of asArray(manifestNode.item as ContentNode[] | ContentNode)) {
    const attrs = item as AttrMap;
    const id = getAttribute(attrs, ['@_id']) ?? '';
    const href = getAttribute(attrs, ['@_href']) ?? '';
    if (!id || !href) {
      continue;
    }
    manifest.set(id, {
      id,
      href,
      mediaType: getAttribute(attrs, ['@_media-type', '@_mediaType']) ?? '',
      properties: getAttribute(attrs, ['@_properties']),
      zipPath: resolveZipPath(opfDir, href)
    });
  }

  const spineNode = (pkg.spine as ContentNode | undefined) ?? {};
  const tocId = getAttribute(spineNode as AttrMap, ['@_toc']);
  const spine: string[] = [];
  for (const ref of asArray(spineNode.itemref as ContentNode[] | ContentNode)) {
    const idref = getAttribute(ref as AttrMap, ['@_idref']);
    if (idref) {
      spine.push(idref);
    }
  }

  return { bookTitle, manifest, spine, tocId };
}

function isXhtmlItem(item: ManifestItem | undefined): boolean {
  if (!item) {
    return false;
  }
  const mediaType = item.mediaType.toLowerCase();
  if (mediaType === 'application/xhtml+xml' || mediaType === 'text/html') {
    return true;
  }
  return /\.(x?html|htm)$/.test(item.zipPath);
}

function extractStructuredText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(extractStructuredText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const parts: string[] = [];
  for (const [key, child] of Object.entries(value as ContentNode)) {
    if (key.startsWith('@_')) {
      continue;
    }
    const text = extractStructuredText(child);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function collectNamedNodes(value: unknown, name: string, out: ContentNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNamedNodes(item, name, out);
    }
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value as ContentNode)) {
    if (key.startsWith('@_')) {
      continue;
    }
    if (key === name) {
      for (const node of asArray(child as ContentNode[] | ContentNode)) {
        if (node && typeof node === 'object') {
          out.push(node as ContentNode);
        }
      }
    }
    collectNamedNodes(child, name, out);
  }
}

function navLooksLikeToc(nav: ContentNode): boolean {
  const type = getAttribute(nav as AttrMap, ['@_type', '@_epub:type']) ?? '';
  const role = getAttribute(nav as AttrMap, ['@_role']) ?? '';
  const typeTokens = type.split(/\s+/);
  const roleTokens = role.split(/\s+/);
  return typeTokens.includes('toc') || roleTokens.includes('doc-toc');
}

function findTocNav(parsed: ContentNode): ContentNode | undefined {
  const navs: ContentNode[] = [];
  collectNamedNodes(parsed, 'nav', navs);
  return navs.find((nav) => nav.ol !== undefined && navLooksLikeToc(nav))
    ?? navs.find((nav) => nav.ol !== undefined);
}

function flattenNavPoints(
  navPoints: ContentNode[] | ContentNode,
  navDir: string,
  out: { title: string; zipPath: string }[]
): void {
  for (const point of asArray(navPoints)) {
    const label = (point.navLabel as ContentNode | undefined) ?? {};
    const title = extractStructuredText(label.text).trim();
    const content = (point.content as ContentNode | undefined) ?? {};
    const src = getAttribute(content as AttrMap, ['@_src']);
    if (title && src) {
      out.push({ title, zipPath: resolveZipPath(navDir, src) });
    }
    if (point.navPoint !== undefined) {
      flattenNavPoints(point.navPoint as ContentNode[] | ContentNode, navDir, out);
    }
  }
}

function flattenNavList(
  list: ContentNode[] | ContentNode,
  navDir: string,
  out: { title: string; zipPath: string }[]
): void {
  for (const li of asArray(list)) {
    const anchor = asArray(li.a as ContentNode[] | ContentNode | string | undefined)[0];
    let title = '';
    let src: string | undefined;
    if (typeof anchor === 'string') {
      title = anchor.trim();
    } else if (anchor && typeof anchor === 'object') {
      title = extractStructuredText(anchor);
      src = getAttribute(anchor as AttrMap, ['@_href']);
    }
    if (title && src) {
      out.push({ title, zipPath: resolveZipPath(navDir, src) });
    }
    if (li.ol !== undefined) {
      flattenNavList(li.ol as ContentNode[] | ContentNode, navDir, out);
    }
  }
}

function buildChapterTitles(
  zip: ZipReader,
  manifest: Map<string, ManifestItem>,
  tocId: string | undefined
): Map<string, string> {
  const titles = new Map<string, string>();

  // 优先 epub3 nav（properties=nav）
  let navItem: ManifestItem | undefined;
  for (const item of manifest.values()) {
    if (item.properties?.split(/\s+/).includes('nav')) {
      navItem = item;
      break;
    }
  }

  if (navItem) {
    const navXml = zip.read(navItem.zipPath);
    if (navXml) {
      const parsed = structParser.parse(navXml) as ContentNode;
      const nav = findTocNav(parsed);
      const entries: { title: string; zipPath: string }[] = [];
      if (nav?.ol !== undefined) {
        flattenNavList(nav.ol as ContentNode[] | ContentNode, path.posix.dirname(navItem.zipPath), entries);
      }
      for (const entry of entries) {
        // 当前阅读模型以 spine XHTML 文件为章节粒度；同一文件内多个 #fragment TOC
        // 先使用第一个标题，避免目录树出现无法精确跳转的 fragment 级章节。
        if (!titles.has(normalizeZipPath(entry.zipPath))) {
          titles.set(normalizeZipPath(entry.zipPath), entry.title);
        }
      }
      if (titles.size > 0) {
        return titles;
      }
    }
  }

  // 回退 epub2 NCX
  if (tocId) {
    const ncxItem = manifest.get(tocId);
    const ncxXml = ncxItem ? zip.read(ncxItem.zipPath) : undefined;
    if (ncxXml) {
      const parsed = structParser.parse(ncxXml) as ContentNode;
      const ncx = (parsed.ncx as ContentNode | undefined) ?? {};
      const navMap = (ncx.navMap as ContentNode | undefined) ?? {};
      const entries: { title: string; zipPath: string }[] = [];
      if (navMap.navPoint !== undefined) {
        flattenNavPoints(
          navMap.navPoint as ContentNode[] | ContentNode,
          ncxItem ? path.posix.dirname(ncxItem.zipPath) : '',
          entries
        );
      }
      for (const entry of entries) {
        if (!titles.has(normalizeZipPath(entry.zipPath))) {
          titles.set(normalizeZipPath(entry.zipPath), entry.title);
        }
      }
    }
  }

  return titles;
}

function matchChapterTitle(
  titles: Map<string, string>,
  zipPath: string,
  index: number,
  firstHeading: string | undefined
): string {
  const normalized = normalizeZipPath(zipPath);
  if (titles.has(normalized)) {
    return titles.get(normalized)!;
  }
  // 容错：仅当 basename 唯一命中时再匹配，避免不同目录下同名 XHTML 被误配标题。
  const basename = path.posix.basename(normalized);
  const basenameMatches = [...titles.entries()].filter(
    ([pathKey]) => path.posix.basename(pathKey) === basename
  );
  if (basenameMatches.length === 1) {
    return basenameMatches[0][1];
  }
  if (firstHeading) {
    return firstHeading;
  }
  return `第 ${index + 1} 章`;
}

export async function extractEpub(filePath: string): Promise<EpubExtraction> {
  const buffer = await fs.promises.readFile(filePath);
  const zip = new ZipReader(buffer);

  const containerXml = zip.read('META-INF/container.xml');
  if (!containerXml) {
    throw new Error('Invalid epub: missing META-INF/container.xml');
  }
  const opfPath = parseContainerOpfPath(containerXml);
  if (!opfPath) {
    throw new Error('Invalid epub: container.xml has no rootfile');
  }
  const opfDir = path.posix.dirname(opfPath);
  const opfXml = zip.read(opfPath);
  if (!opfXml) {
    throw new Error(`Invalid epub: OPF not found at ${opfPath}`);
  }

  const { bookTitle, manifest, spine, tocId } = parseManifestAndSpine(opfXml, opfDir);
  const titles = buildChapterTitles(zip, manifest, tocId);

  const chapters: EpubChapter[] = [];

  spine.forEach((idref) => {
    const item = manifest.get(idref);
    if (!item || !isXhtmlItem(item)) {
      return;
    }
    // 跳过 nav/目录文档本身（properties=nav），它不是阅读正文
    if (item.properties?.split(/\s+/).includes('nav')) {
      return;
    }
    const xhtml = zip.read(item.zipPath);
    if (!xhtml) {
      return;
    }
    const chapterDir = path.posix.dirname(item.zipPath);
    let parsed: { text: string; images: EpubImage[]; firstHeading: string | undefined };
    try {
      parsed = extractChapterText(xhtml, chapterDir, manifest);
    } catch {
      // 单章 XHTML 解析失败不应中断全书，跳过该章
      return;
    }
    const { text, images, firstHeading } = parsed;
    if (!text) {
      return;
    }
    const chapterIndex = chapters.length;
    const chapter: EpubChapter = {
      title: matchChapterTitle(titles, item.zipPath, chapterIndex, firstHeading),
      text,
      images
    };
    chapters.push(chapter);
  });

  if (chapters.length === 0) {
    throw new Error('Invalid epub: no readable chapters');
  }

  return { bookTitle, chapters };
}

/** 按需读取 epub 内某张图片的原始字节（看图时调用，不进缓存）。 */
export async function readEpubImageBytes(
  filePath: string,
  zipPath: string
): Promise<Uint8Array | undefined> {
  const buffer = await fs.promises.readFile(filePath);
  const zip = new ZipReader(buffer);
  return zip.readBytes(zipPath);
}
