import fs from 'fs';
import path from 'path';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.js';
import { PNG } from 'pngjs';
import type {
  ChapterRef,
  PdfExtraction,
  PdfImageMeta,
  PdfPage
} from '../../domain/books';
import { pdfjsLib } from './PdfJsNodeCompat';
import { normalizeCjkSpacing } from './TextNormalization';

/**
 * PDF 文本/图片抽取。对应 epub 的 EpubExtractor。
 *
 * 依赖 pdfjs-dist@3（CJS，legacy build）。pdfjs 在 Node 下不开 DOM worker——
 * 设 GlobalWorkerOptions.workerSrc 到随包的 worker 文件即可主线程解析（spike 验证）。
 *
 * 文本：逐页 getTextContent，按 item.hasEOL 断段，拼接为纯文本。
 * 图片：逐页 getOperatorList 扫描 paintImageXObject，记录每页图片元信息（数量/尺寸），
 *   不解码字节；按 i 查看时由 readPdfImageBytes 按需解码（pdfjs 已把图解码为 RGB/RGBA，
 *   用 pngjs 编码为 PNG）。
 */

export type { PdfExtraction, PdfImageMeta, PdfPage };

export type PdfImageBytes = {
  bytes: Uint8Array;
  mediaType: string;
};

// 与 pdfjs ImageKind 对齐（pdfjs display/utils）：1=1bpp 灰度，2=RGB_24BPP，3=RGBA_32BPP。
const IMAGE_KIND_GRAYSCALE_1BPP = 1;
const IMAGE_KIND_RGB_24BPP = 2;
const IMAGE_KIND_RGBA_32BPP = 3;

// pdfjs 操作列表的最小结构形态（getOperatorList 返回 {fnArray, argsArray, ...}）。
type PdfOperatorListLike = {
  fnArray: number[] | Int32Array;
  argsArray: unknown[];
};

// pdfjs 已解码图片对象的最小形态（spike 确认 page.objs.get(name) 返回 {width,height,kind,data}）。
type PdfjsImageObject = {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
};

let pdfjsInitialized = false;

function ensurePdfjs(): void {
  if (pdfjsInitialized) {
    return;
  }
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
      'pdfjs-dist/legacy/build/pdf.worker.js'
    );
  } catch {
    // 取不到 worker 文件时退回主线程解析（pdfjs fake worker）。
  }
  pdfjsInitialized = true;
}

async function loadPdfDocument(filePath: string): Promise<PDFDocumentProxy> {
  ensurePdfjs();
  // 不能直接把 fs.readFile 的 Node Buffer 喂给 pdfjs：兼容垫片把 process.type 置为 'browser'
  // 后 pdfjs 的 isNodeJS=true，其 getDataProp 会显式拒绝 Buffer（"Please provide binary data
  // as Uint8Array, rather than Buffer"）；且 worker 路径会 transfer data.buffer，Buffer 可能
  // 共享池内存，detach 会污染其他 Buffer。故转成独占 ArrayBuffer 的 Uint8Array
  // （new Uint8Array(buf) 会拷一份整本字节，代价一次性、可接受）。
  const data = new Uint8Array(await fs.promises.readFile(filePath));
  // 不传 cMapUrl / standardFontDataUrl：pdfjs 在 isNodeJS=false 时会计算 useWorkerFetch，
  // 其表达式引用 document.baseURI → "document is not defined"。留空使其短路，走内置字体/CMap 回退。
  return pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
}

/** 取页文本：按 item.hasEOL 断段，合并多余空行。 */
function buildPageText(items: ReadonlyArray<unknown>): string {
  let text = '';
  for (const raw of items) {
    const item = raw as { str?: string; hasEOL?: boolean };
    text += item.str ?? '';
    if (item.hasEOL) {
      text += '\n';
    }
  }
  return normalizeCjkSpacing(text.replace(/\n{3,}/g, '\n\n').trim());
}

/** 扫描页操作列表里的 paintImageXObject，返回按出现顺序的图片元信息。 */
function scanPageImages(operatorList: PdfOperatorListLike): PdfImageMeta[] {
  const images: PdfImageMeta[] = [];
  const { fnArray, argsArray } = operatorList;
  for (let k = 0; k < fnArray.length; k++) {
    if (fnArray[k] !== pdfjsLib.OPS.paintImageXObject) {
      continue;
    }
    const args = argsArray[k] as unknown[] | undefined;
    // args = [name: string, width: number, height: number]
    images.push({
      index: images.length,
      width: typeof args?.[1] === 'number' ? args[1] : undefined,
      height: typeof args?.[2] === 'number' ? args[2] : undefined
    });
  }
  return images;
}

export async function extractPdf(filePath: string): Promise<PdfExtraction> {
  const doc = await loadPdfDocument(filePath);
  try {
    let bookTitle = path.basename(filePath).replace(/\.pdf$/i, '');
    try {
      const meta = await doc.getMetadata();
      const info = meta?.info as { Title?: unknown } | undefined;
      const title = info?.Title;
      if (typeof title === 'string' && title.trim()) {
        bookTitle = title.trim();
      }
    } catch {
      // 元数据读取失败不影响抽取
    }

    const pages: PdfPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const [textContent, operatorList] = await Promise.all([
        page.getTextContent(),
        page.getOperatorList()
      ]);
      pages.push({
        title: `第 ${i} 页`,
        text: buildPageText(textContent.items),
        images: scanPageImages(operatorList)
      });
      page.cleanup();
    }

    if (pages.length === 0) {
      throw new Error('Invalid pdf: no pages');
    }

    return { bookTitle, pages };
  } finally {
    await doc.destroy();
  }
}

/** 把抽取结果映射成书架树展示用的页面引用（对应 epub toChapterRefs）。 */
export function toPageRefs(extraction: PdfExtraction): ChapterRef[] {
  return extraction.pages.map((page) => ({ title: page.title }));
}

async function getImageObject(
  page: PDFPageProxy,
  name: string
): Promise<PdfjsImageObject | undefined> {
  // 同步路径：操作列表解析后命名 XObject 通常已就绪。
  const sync = page.objs.get(name) as PdfjsImageObject | undefined;
  if (sync) {
    return sync;
  }
  // 异步兜底：带回调 + 超时，避免个别图未就绪时永久挂起。
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: PdfjsImageObject | undefined) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(value);
      }
    };
    const timer = setTimeout(() => finish(undefined), 10_000);
    try {
      page.objs.get(name, (value: PdfjsImageObject | undefined) => finish(value));
    } catch {
      finish(undefined);
    }
  });
}

/** 收集页内 paintImageXObject 的图片名（按出现顺序），与 scanPageImages 的 index 对齐。 */
function collectPageImageNames(operatorList: PdfOperatorListLike): string[] {
  const names: string[] = [];
  const { fnArray, argsArray } = operatorList;
  for (let k = 0; k < fnArray.length; k++) {
    if (fnArray[k] !== pdfjsLib.OPS.paintImageXObject) {
      continue;
    }
    const name = (argsArray[k] as unknown[] | undefined)?.[0];
    if (typeof name === 'string') {
      names.push(name);
    }
  }
  return names;
}

/** 把 pdfjs 已解码的图片对象转成 PNG 字节；不支持 kind 时返回 null。 */
function decodePdfImageToPng(image: PdfjsImageObject): Uint8Array | null {
  const { width, height, kind, data } = image;
  if (!width || !height || !data) {
    return null;
  }
  const rgba = imageDataToRgba(width, height, kind ?? 0, data);
  if (!rgba) {
    return null;
  }
  const png = new PNG({ width, height });
  png.data = rgba;
  return PNG.sync.write(png);
}

function imageDataToRgba(
  width: number,
  height: number,
  kind: number,
  data: Uint8Array | Uint8ClampedArray
): Buffer | null {
  const pixelCount = width * height;
  const out = Buffer.alloc(pixelCount * 4);
  const src = Buffer.from(data);

  if (kind === IMAGE_KIND_RGBA_32BPP) {
    if (src.length < pixelCount * 4) {
      return null;
    }
    src.copy(out, 0, 0, pixelCount * 4);
    return out;
  }

  if (kind === IMAGE_KIND_RGB_24BPP) {
    if (src.length < pixelCount * 3) {
      return null;
    }
    for (let i = 0, j = 0; i < pixelCount * 3; i += 3, j += 4) {
      out[j] = src[i];
      out[j + 1] = src[i + 1];
      out[j + 2] = src[i + 2];
      out[j + 3] = 255;
    }
    return out;
  }

  if (kind === IMAGE_KIND_GRAYSCALE_1BPP) {
    const rowBytes = Math.ceil(width / 8);
    if (src.length < rowBytes * height) {
      return null;
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = src[y * rowBytes + (x >> 3)];
        const bit = (byte >> (7 - (x & 7))) & 1;
        // pdfjs 1bpp：bit=1 为黑
        const v = bit ? 0 : 255;
        const j = (y * width + x) * 4;
        out[j] = out[j + 1] = out[j + 2] = v;
        out[j + 3] = 255;
      }
    }
    return out;
  }

  return null;
}

/**
 * 按需读取某页第 imageIndex 张图的字节（PNG），用于 i 看图。
 * 对应 epub readEpubImageBytes——重开 PDF、定位页、解码该图；失败返回 undefined。
 */
export async function readPdfImageBytes(
  filePath: string,
  pageIndex: number,
  imageIndex: number
): Promise<PdfImageBytes | undefined> {
  const doc = await loadPdfDocument(filePath);
  try {
    if (pageIndex < 0 || pageIndex >= doc.numPages) {
      return undefined;
    }
    const page = await doc.getPage(pageIndex + 1);
    const operatorList = await page.getOperatorList();
    const names = collectPageImageNames(operatorList);
    const name = names[imageIndex];
    if (!name) {
      return undefined;
    }
    const image = await getImageObject(page, name);
    if (!image) {
      return undefined;
    }
    const bytes = decodePdfImageToPng(image);
    if (!bytes) {
      return undefined;
    }
    return { bytes, mediaType: 'image/png' };
  } catch {
    return undefined;
  } finally {
    await doc.destroy();
  }
}
