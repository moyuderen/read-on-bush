import { commands } from 'vscode';
import { CustomWhenClauseContext } from '../../core/Commands';
import { updateTxtStatusBarVisibility } from '../../core/barItems';
import message from '../../utils/message';
import type { BookData, BookFormat, BookNavigationTarget } from '../../domain/books';
import type { ReadBook } from '../../core/ReadBook';
import type { BookReaderController } from '../../formats';

export class ReadingSessionService {
  private currentReader?: BookReaderController;

  constructor(private readonly app: ReadBook) {}

  get current(): BookReaderController | undefined {
    return this.currentReader;
  }

  async open(book: BookData): Promise<void> {
    await this.closeCurrent();
    const provider = this.app.formatRegistry.getProviderForBook(book);

    if (!provider) {
      message.error('暂不支持该书籍格式');
      return;
    }

    const reader = await provider.createReader({ book, app: this.app });
    this.currentReader = reader;
    await reader.open();
    await this.updateFormatContext(reader.format);
  }

  async next(): Promise<void> {
    await this.currentReader?.next();
  }

  async previous(): Promise<void> {
    await this.currentReader?.previous();
  }

  async jumpTo(target: BookNavigationTarget): Promise<void> {
    if (!this.currentReader?.jumpTo) {
      message.warn('当前书籍不支持该跳转方式');
      return;
    }

    await this.currentReader.jumpTo(target);
  }

  async closeCurrent(): Promise<void> {
    if (!this.currentReader) {
      return;
    }

    const reader = this.currentReader;
    this.currentReader = undefined;
    await reader.close();
    await this.updateFormatContext(undefined);
  }

  refreshSettings(): void {
    this.currentReader?.refreshSettings?.();
  }

  /**
   * 同步当前阅读格式到 VS Code 上下文和状态栏可见性。
   */
  private async updateFormatContext(format: BookFormat | undefined): Promise<void> {
    await commands.executeCommand(
      'setContext',
      CustomWhenClauseContext.IsTxtReading,
      format === 'txt'
    );
    updateTxtStatusBarVisibility(format);
  }
}
