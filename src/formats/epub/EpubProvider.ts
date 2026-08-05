import fs from 'fs';
import message from '../../utils/message';
import type { BookData, BookFormat, BookOutlineItem } from '../../domain/books';
import { extractEpub, toChapterRefs } from '../../core/parsers/EpubExtractor';
import { EpubCache } from '../../core/storage/EpubCache';
import type { BookFormatProvider, CreateReaderInput, ImportBookInput } from '../types';
import { EpubReadingController } from './EpubReadingController';

export class EpubProvider implements BookFormatProvider {
  readonly format: BookFormat = 'epub';
  readonly supportedExtensions = ['epub'];

  async importBook(input: ImportBookInput): Promise<BookData> {
    const bookData: BookData = {
      name: input.name,
      id: input.id,
      process: 0,
      url: input.filePath,
      format: this.format,
      epubProgress: { chapterIndex: 0, charOffset: 0 }
    };

    try {
      const extraction = await extractEpub(bookData.url);
      bookData.chapters = toChapterRefs(extraction);

      const stat = await fs.promises.stat(bookData.url);
      const cache = EpubCache.create(input.context.globalStorageUri);
      await cache.set(bookData.id, stat.mtimeMs, extraction);
    } catch (error) {
      const text = error instanceof Error ? error.message : '解析 epub 失败';
      message.warn(`${input.displayName ?? `《${bookData.name}》`}${text}，仍已加入书架`);
    }

    return bookData;
  }

  async createReader(input: CreateReaderInput): Promise<EpubReadingController> {
    return new EpubReadingController(input.book, input.app.epubReader);
  }

  async getOutline(book: BookData): Promise<BookOutlineItem[]> {
    return (book.chapters ?? []).map((chapter, index) => ({
      id: `${book.id}:section:${index}`,
      title: chapter.title,
      target: { kind: 'section', sectionIndex: index }
    }));
  }

  async deleteCache(book: BookData, context: ImportBookInput['context']): Promise<void> {
    await EpubCache.create(context.globalStorageUri).delete(book.id);
  }
}
