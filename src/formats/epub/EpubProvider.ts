import { Uri } from 'vscode';
import type { BookData, BookFormat, BookOutlineItem } from '../../domain/books';
import {
  extractEpub,
  toChapterRefs,
  type EpubExtraction
} from '../../infrastructure/parsers/EpubExtractor';
import { EpubCache } from '../../infrastructure/storage/EpubCache';
import type { BookFormatProvider, CreateReaderInput, ImportBookInput } from '../BookFormat';
import { CachedExtractionLoader } from '../CachedExtractionLoader';
import { createBookOutline, importCachedBook } from '../FormatProviderHelpers';
import { EpubReader } from './EpubReader';

export class EpubProvider implements BookFormatProvider {
  readonly format: BookFormat = 'epub';
  readonly supportedExtensions = ['epub'];
  private readonly cache: EpubCache;
  private readonly extractionLoader: CachedExtractionLoader<EpubExtraction>;

  constructor(cacheDirectory: Uri = Uri.file(process.cwd())) {
    this.cache = EpubCache.create(cacheDirectory);
    this.extractionLoader = new CachedExtractionLoader(this.cache, extractEpub);
  }

  importBook(input: ImportBookInput): Promise<BookData> {
    return importCachedBook({
      input,
      createBook: (bookInput) => ({
        name: bookInput.name,
        id: bookInput.id,
        process: 0,
        url: bookInput.filePath,
        format: this.format,
        epubProgress: { chapterIndex: 0, charOffset: 0 }
      }),
      extract: extractEpub,
      toChapterRefs,
      cache: this.cache,
      failurePrefix: '解析 epub 失败'
    });
  }

  createReader(input: CreateReaderInput): EpubReader {
    return new EpubReader(input.book, input.services, this.extractionLoader);
  }

  getOutline(book: BookData): Promise<BookOutlineItem[]> {
    return Promise.resolve(createBookOutline(book));
  }

  deleteCache(book: BookData): Promise<void> {
    return this.cache.delete(book.id);
  }
}
