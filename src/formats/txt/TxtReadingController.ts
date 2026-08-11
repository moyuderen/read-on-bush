import { TxtBook } from '../../domain/books/TxtBook';
import type { BookData, BookFormat, BookNavigationTarget, ReadingDisplayState } from '../../domain/books';
import { createBookParser } from '../../infrastructure/parsers';
import { getLineWidth, getTxtEncoding } from '../../config/settings';
import type {
  BookReaderController,
  ReaderServices,
  TxtReaderCapability
} from '../BookFormat';

export class TxtReadingController implements BookReaderController {
  readonly format: BookFormat = 'txt';
  readonly txt: TxtReaderCapability = this;
  private readingBook?: TxtBook;
  private openGeneration = 0;

  constructor(readonly book: BookData, private readonly services: ReaderServices) {}

  get currentTxtState(): ReadingDisplayState | undefined {
    return this.readingBook?.getDisplayState();
  }

  get currentTxtPageCount(): number {
    return this.readingBook?.contents.length ?? 0;
  }

  async open(): Promise<boolean> {
    const generation = ++this.openGeneration;
    try {
      const parser = createBookParser(this.book.url, {
        lineWidth: getLineWidth(),
        encoding: getTxtEncoding()
      });
      const contents = await parser.readContent();
      if (generation !== this.openGeneration) {
        return false;
      }

      this.readingBook = new TxtBook(this.book, contents, {
        display: this.services.txtDisplay,
        progress: this.services.bookCatalog,
        notifier: this.services.notifier
      });
      this.services.notifier.info(
        `Switch to ${this.services.privacyDisplay.getBookMessageName(this.book)} !`
      );
      this.readingBook.start();
      return true;
    } catch (error) {
      if (generation !== this.openGeneration) {
        return false;
      }
      const text = error instanceof Error ? error.message : 'Parse book failed !';
      this.services.notifier.error(text);
      this.readingBook = undefined;
      return false;
    }
  }

  async close(): Promise<void> {
    this.openGeneration += 1;
    this.readingBook?.pause();
    this.readingBook?.dispose();
    this.readingBook = undefined;
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

  start(): void {
    this.readingBook?.start();
  }

  stop(): void {
    this.readingBook?.pause();
  }
}
