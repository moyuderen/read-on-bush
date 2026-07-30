import { Uri, workspace } from 'vscode';
import type { PdfExtraction } from '../parsers/PdfExtractor';

const PDF_EXTRACTION_CACHE_VERSION = 1;

export type PdfCacheRecord = {
  version: number;
  fileMtime: number;
  extraction: PdfExtraction;
};

function sanitizeFileName(bookId: string): string {
  return bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPdfExtraction(value: unknown): value is PdfExtraction {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const extraction = value as { bookTitle?: unknown; pages?: unknown };
  if (typeof extraction.bookTitle !== 'string' || !Array.isArray(extraction.pages)) {
    return false;
  }
  // extractPdf 保证至少一页；空数组只可能来自旧版/损坏缓存，必须触发重新抽取。
  if (extraction.pages.length === 0) {
    return false;
  }

  return extraction.pages.every((rawPage) => {
    if (!rawPage || typeof rawPage !== 'object') {
      return false;
    }
    const page = rawPage as { title?: unknown; text?: unknown; images?: unknown };
    if (
      typeof page.title !== 'string' ||
      typeof page.text !== 'string' ||
      !Array.isArray(page.images)
    ) {
      return false;
    }
    return page.images.every((rawImage) => {
      if (!rawImage || typeof rawImage !== 'object') {
        return false;
      }
      const image = rawImage as { index?: unknown; width?: unknown; height?: unknown };
      return (
        Number.isInteger(image.index) &&
        (image.index as number) >= 0 &&
        (image.width === undefined || isFiniteNumber(image.width)) &&
        (image.height === undefined || isFiniteNumber(image.height))
      );
    });
  });
}

function isPdfCacheRecord(value: unknown): value is PdfCacheRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as { version?: unknown; fileMtime?: unknown; extraction?: unknown };
  return (
    record.version === PDF_EXTRACTION_CACHE_VERSION &&
    isFiniteNumber(record.fileMtime) &&
    isPdfExtraction(record.extraction)
  );
}

/**
 * pdf 提取结果缓存。镜像 EpubCache：按源文件 mtime 失效，存于扩展全局存储目录
 * （globalStorageUri/cache），与 epub 共用 cache 目录——文件名是 <bookId>.json，
 * 一个 bookId 只属一种格式，互不冲突。只缓存文本 + 图片元信息，不含图片字节（按需解码）。
 */
export class PdfCache {
  constructor(private readonly cacheDir: Uri) {}

  static create(globalStorageUri: Uri): PdfCache {
    return new PdfCache(Uri.joinPath(globalStorageUri, 'cache'));
  }

  async get(bookId: string, fileMtime: number): Promise<PdfExtraction | undefined> {
    let bytes: Uint8Array;
    try {
      bytes = await workspace.fs.readFile(this.recordUri(bookId));
    } catch {
      return undefined;
    }

    try {
      const record = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as unknown;
      if (!isPdfCacheRecord(record) || record.fileMtime !== fileMtime) {
        return undefined;
      }
      return record.extraction;
    } catch {
      return undefined;
    }
  }

  async set(bookId: string, fileMtime: number, extraction: PdfExtraction): Promise<void> {
    await workspace.fs.createDirectory(this.cacheDir);
    const record: PdfCacheRecord = {
      version: PDF_EXTRACTION_CACHE_VERSION,
      fileMtime,
      extraction
    };
    const json = JSON.stringify(record);
    await workspace.fs.writeFile(this.recordUri(bookId), new TextEncoder().encode(json));
  }

  async delete(bookId: string): Promise<void> {
    try {
      await workspace.fs.delete(this.recordUri(bookId));
    } catch {
      // 缺失即视为已删除
    }
  }

  private recordUri(bookId: string): Uri {
    return Uri.joinPath(this.cacheDir, `${sanitizeFileName(bookId)}.json`);
  }
}
