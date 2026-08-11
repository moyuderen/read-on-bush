import { TxtBook } from '../../domain/books/TxtBook';
import type { BookData, BookFormat, BookNavigationTarget, ReadingDisplayState } from '../../domain/books';
import type { SearchDocument } from '../../domain/search';
import { createTxtSearchDocument } from '../SearchDocumentBuilders';
import { createConfiguredTxtParser } from './createTxtParser';
import type {
  BookReaderController,
  ReaderJumpOptions,
  ReaderServices,
  TxtReaderCapability
} from '../BookFormat';

export class TxtReadingController implements BookReaderController {
  readonly format: BookFormat = 'txt';
  readonly txt: TxtReaderCapability = this;
  private readingBook?: TxtBook;
  private searchDocument?: SearchDocument;
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
      const parser = createConfiguredTxtParser(this.book.url);
      const searchSegments = await parser.readSearchSegments();
      const contents = searchSegments.map((segment) => segment.text);
      if (generation !== this.openGeneration) {
        return false;
      }

      this.searchDocument = searchSegments
        ? createTxtSearchDocument(this.book.id, searchSegments)
        : undefined;
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
    this.searchDocument = undefined;
  }

  async next(): Promise<void> {
    this.readingBook?.nextLine();
  }

  async previous(): Promise<void> {
    this.readingBook?.prevLine();
  }

  async jumpTo(target: BookNavigationTarget, options?: ReaderJumpOptions): Promise<void> {
    if (target.kind === 'page') {
      this.readingBook?.jumpLine(target.pageIndex, options?.persistProgress !== false);
    }
  }

  getCurrentLocation(): BookNavigationTarget | undefined {
    const state = this.readingBook?.getDisplayState();
    return state ? { kind: 'page', pageIndex: state.process } : undefined;
  }

  getSearchDocument(): SearchDocument | undefined {
    return this.searchDocument;
  }

  start(): void {
    this.readingBook?.start();
  }

  stop(): void {
    this.readingBook?.pause();
  }
}
