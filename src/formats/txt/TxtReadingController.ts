import { Book } from '../../core/Book';
import type { BookData, BookFormat, BookNavigationTarget } from '../../domain/books';
import type { ReadBook } from '../../core/ReadBook';
import type { BookReaderController } from '../types';

export class TxtReadingController implements BookReaderController {
  readonly format: BookFormat = 'txt';
  private readingBook?: Book;

  constructor(readonly book: BookData, private readonly app: ReadBook) {}

  async open(): Promise<void> {
    this.readingBook = new Book(this.book, this.app);
    this.app.readingBook = this.readingBook;
  }

  async close(): Promise<void> {
    this.readingBook?.pause();
    // 释放旧书的整段 contents，避免切换到其它格式后仍被 app.readingBook 持有。
    this.readingBook = undefined;
    this.app.readingBook = undefined;
  }

  async next(): Promise<void> {
    this.readingBook?.nextLine();
  }

  async previous(): Promise<void> {
    this.readingBook?.prevLine();
  }

  async jumpTo(target: BookNavigationTarget): Promise<void> {
    if (target.kind === 'page') {
      this.readingBook?.jumpLine(target.pageIndex);
    }
  }
}
