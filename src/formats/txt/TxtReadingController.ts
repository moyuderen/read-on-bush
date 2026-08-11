import { TxtBook } from '../../domain/books/TxtBook';
import type { BookData, BookFormat, BookNavigationTarget, ReadingDisplayState } from '../../domain/books';
import type { SearchDocument } from '../../domain/search';
import { createTxtSearchDocument } from '../SearchDocumentBuilders';
import { createConfiguredTxtParser } from './createTxtParser';
import { AutoTurnScheduler, type AutoTurnState } from '../../domain/autoTurn';
import { getAutoTurnConfig } from '../../config/settings';
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
  private autoTurn?: AutoTurnScheduler;

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
      this.autoTurn = new AutoTurnScheduler(
        {
          turnPage: async () => this.tryAdvanceLine(),
          getVisibleText: () => this.readingBook?.getDisplayState().content ?? '',
          onStateChange: (state: AutoTurnState) => {
            if (state === 'running') {
              this.services.notifier.info('自动翻页已开启');
            } else if (state === 'paused') {
              this.services.notifier.info('自动翻页已暂停');
            } else if (state === 'idle' && this.readingBook) {
              const atEnd =
                this.readingBook.getDisplayState().process >=
                this.readingBook.contents.length - 1;
              this.services.notifier.info(
                atEnd ? '已到达末页，自动翻页已停止' : '自动翻页已停止'
              );
            }
          },
          onError: (error) => {
            this.services.notifier.error(
              `自动翻页出错：${error instanceof Error ? error.message : '未知错误'}`
            );
          }
        },
        getAutoTurnConfig
      );
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
    this.disposeAutoTurn();
    this.readingBook?.pause();
    this.readingBook?.dispose();
    this.readingBook = undefined;
    this.searchDocument = undefined;
  }

  async next(): Promise<void> {
    this.autoTurn?.pauseIfRunning();
    this.readingBook?.nextLine();
  }

  async previous(): Promise<void> {
    this.autoTurn?.pauseIfRunning();
    this.readingBook?.prevLine();
  }

  async jumpTo(target: BookNavigationTarget, options?: ReaderJumpOptions): Promise<void> {
    this.autoTurn?.pauseIfRunning();
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

  toggleAutoTurn(): void {
    this.autoTurn?.toggle();
  }

  disposeAutoTurn(): void {
    this.autoTurn?.dispose();
    this.autoTurn = undefined;
  }

  /** 自动翻页专用：在末页时直接返回 false，不触发 nextLine 的 "已经是最后一页了" 通知。 */
  private tryAdvanceLine(): boolean {
    const book = this.readingBook;
    if (!book) {
      return false;
    }
    if (book.getDisplayState().process >= book.contents.length - 1) {
      return false;
    }
    return book.nextLine();
  }
}
