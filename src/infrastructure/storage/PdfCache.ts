import { Uri } from 'vscode';
import type { PdfExtraction } from '../parsers/PdfExtractor';
import {
  ExtractionCache,
  type ExtractionCacheRecord
} from './ExtractionCache';

const PDF_EXTRACTION_CACHE_VERSION = 2;

export type PdfCacheRecord = ExtractionCacheRecord<PdfExtraction>;

export class PdfCache {
  private readonly cache: ExtractionCache<PdfExtraction>;

  constructor(cacheDir: Uri, maxSizeBytes?: number) {
    this.cache = new ExtractionCache(cacheDir, {
      version: PDF_EXTRACTION_CACHE_VERSION,
      isExtraction: isPdfExtraction,
      maxSizeBytes
    });
  }

  static create(globalStorageUri: Uri, maxSizeBytes?: number): PdfCache {
    return new PdfCache(Uri.joinPath(globalStorageUri, 'cache'), maxSizeBytes);
  }

  get(bookId: string, fileMtime: number): Promise<PdfExtraction | undefined> {
    return this.cache.get(bookId, fileMtime);
  }

  set(bookId: string, fileMtime: number, extraction: PdfExtraction): Promise<void> {
    return this.cache.set(bookId, fileMtime, extraction);
  }

  delete(bookId: string): Promise<void> {
    return this.cache.delete(bookId);
  }

  getCacheSize(): Promise<number> {
    return this.cache.getCacheSize();
  }

  setMaxSizeBytes(maxSizeBytes: number): Promise<void> {
    return this.cache.setMaxSizeBytes(maxSizeBytes);
  }

  clearAll(): Promise<void> {
    return this.cache.clearAll();
  }
}

function isPdfExtraction(value: unknown): value is PdfExtraction {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const extraction = value as { bookTitle?: unknown; pages?: unknown };
  if (
    typeof extraction.bookTitle !== 'string' ||
    !Array.isArray(extraction.pages) ||
    extraction.pages.length === 0
  ) {
    return false;
  }

  return extraction.pages.every((rawPage) => {
    if (!rawPage || typeof rawPage !== 'object') {
      return false;
    }
    const page = rawPage as { title?: unknown; text?: unknown; images?: unknown };
    return (
      typeof page.title === 'string' &&
      typeof page.text === 'string' &&
      Array.isArray(page.images) &&
      page.images.every(isPdfImage)
    );
  });
}

function isPdfImage(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const image = value as { index?: unknown; width?: unknown; height?: unknown };
  return (
    Number.isInteger(image.index) &&
    (image.index as number) >= 0 &&
    (image.width === undefined || isFiniteNumber(image.width)) &&
    (image.height === undefined || isFiniteNumber(image.height))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
