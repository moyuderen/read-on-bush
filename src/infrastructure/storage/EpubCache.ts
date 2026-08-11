import { Uri } from 'vscode';
import type { EpubExtraction } from '../parsers/EpubExtractor';
import {
  ExtractionCache,
  type ExtractionCacheRecord
} from './ExtractionCache';

const EPUB_EXTRACTION_CACHE_VERSION = 3;

export type EpubCacheRecord = ExtractionCacheRecord<EpubExtraction>;

export class EpubCache {
  private readonly cache: ExtractionCache<EpubExtraction>;

  constructor(cacheDir: Uri) {
    this.cache = new ExtractionCache(cacheDir, {
      version: EPUB_EXTRACTION_CACHE_VERSION,
      isExtraction: isEpubExtraction
    });
  }

  static create(globalStorageUri: Uri): EpubCache {
    return new EpubCache(Uri.joinPath(globalStorageUri, 'cache'));
  }

  get(bookId: string, fileMtime: number): Promise<EpubExtraction | undefined> {
    return this.cache.get(bookId, fileMtime);
  }

  set(bookId: string, fileMtime: number, extraction: EpubExtraction): Promise<void> {
    return this.cache.set(bookId, fileMtime, extraction);
  }

  delete(bookId: string): Promise<void> {
    return this.cache.delete(bookId);
  }
}

function isEpubExtraction(value: unknown): value is EpubExtraction {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const extraction = value as { bookTitle?: unknown; chapters?: unknown };
  return (
    typeof extraction.bookTitle === 'string' &&
    Array.isArray(extraction.chapters) &&
    extraction.chapters.every(isEpubChapter)
  );
}

function isEpubChapter(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const chapter = value as { title?: unknown; text?: unknown; images?: unknown };
  return (
    typeof chapter.title === 'string' &&
    typeof chapter.text === 'string' &&
    Array.isArray(chapter.images) &&
    chapter.images.every(isEpubImage)
  );
}

function isEpubImage(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const image = value as { zipPath?: unknown; mediaType?: unknown; charOffset?: unknown };
  return (
    typeof image.zipPath === 'string' &&
    typeof image.mediaType === 'string' &&
    Number.isInteger(image.charOffset) &&
    (image.charOffset as number) >= 0
  );
}
