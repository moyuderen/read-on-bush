import { EventEmitter } from 'vscode';
import type {
  BookData,
  BookFormat,
  BookNavigationTarget,
  ReadingDisplayState,
  TxtReadingPort
} from '../domain/books';
import type {
  BookReaderController,
  ReaderJumpOptions,
  ReaderServices,
  TxtReaderCapability
} from '../formats';
import type { ApplicationContext } from './ApplicationContext';

export class ReadingSession implements TxtReadingPort {
  private currentReader?: BookReaderController;
  private openGeneration = 0;
  private readonly formatEmitter = new EventEmitter<BookFormat | undefined>();

  constructor(private readonly app: ApplicationContext) {
    app.context.subscriptions.push(this.formatEmitter);
  }

  readonly onDidChangeFormat = this.formatEmitter.event;

  get current(): BookReaderController | undefined {
    return this.currentReader;
  }

  get currentTxtState(): ReadingDisplayState | undefined {
    return this.txtReader?.currentTxtState;
  }

  get currentTxtPageCount(): number {
    return this.txtReader?.currentTxtPageCount ?? 0;
  }

  async open(book: BookData): Promise<void> {
    await this.closeCurrent();
    const generation = ++this.openGeneration;
    const provider = this.app.formatRegistry.getProviderForBook(book);

    if (!provider) {
      this.app.notifier.error('暂不支持该书籍格式');
      return;
    }

    const reader = await provider.createReader({ book, services: this.createReaderServices() });
    this.currentReader = reader;
    const opened = await reader.open();
    if (generation !== this.openGeneration || this.currentReader !== reader) {
      await reader.close();
      reader.dispose?.();
      return;
    }

    if (!opened) {
      this.currentReader = undefined;
      reader.dispose?.();
      this.formatEmitter.fire(undefined);
      this.app.showIdleReaderHint();
      return;
    }

    this.app.bookList.markLastOpened(book.id);
    this.formatEmitter.fire(reader.format);
    void this.app.searchService.prewarm(reader.book);
  }

  async next(): Promise<void> {
    await this.currentReader?.next();
  }

  async previous(): Promise<void> {
    await this.currentReader?.previous();
  }

  async jumpTo(target: BookNavigationTarget, options?: ReaderJumpOptions): Promise<void> {
    if (!this.currentReader?.jumpTo) {
      this.app.notifier.warn('当前书籍不支持该跳转方式');
      return;
    }

    await this.currentReader.jumpTo(target, options);
  }

  async closeCurrent(): Promise<void> {
    this.openGeneration += 1;
    if (!this.currentReader) {
      return;
    }

    // 翻页进度是防抖写入的，关闭前立即 flush 并等待持久化完成，确保最后一次进度不丢失。
    await this.app.bookList.flushProgressWrite();

    const reader = this.currentReader;
    this.app.searchService.clear(reader.book.id);
    this.currentReader = undefined;
    await reader.close();
    reader.dispose?.();
    this.formatEmitter.fire(undefined);
    this.app.showIdleReaderHint();
  }

  refreshSettings(): void {
    this.currentReader?.refreshSettings?.();
  }

  refreshPrivacyDisplay(): void {
    this.currentReader?.refreshPrivacyDisplay?.();
  }

  async nextTxt(): Promise<void> {
    if (this.txtReader) {
      await this.currentReader?.next();
    }
  }

  async previousTxt(): Promise<void> {
    if (this.txtReader) {
      await this.currentReader?.previous();
    }
  }

  async jumpTxt(pageIndex: number): Promise<void> {
    if (this.txtReader) {
      await this.currentReader?.jumpTo?.({ kind: 'page', pageIndex });
    }
  }

  startTxt(): void {
    this.txtReader?.start();
  }

  stopTxt(): void {
    this.txtReader?.stop();
  }

  private get txtReader(): TxtReaderCapability | undefined {
    return this.currentReader?.txt;
  }

  private createReaderServices(): ReaderServices {
    return {
      readerSurface: this.app.readerSurface,
      templateService: this.app.templateService,
      privacyDisplay: this.app.privacyDisplay,
      bookCatalog: this.app.bookList,
      notifier: this.app.notifier,
      txtDisplay: this.app.displayManager
    };
  }
}
