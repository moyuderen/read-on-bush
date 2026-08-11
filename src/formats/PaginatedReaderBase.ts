import { commands } from 'vscode';
import type { Disposable } from 'vscode';
import type { BookData, BookFormat, BookNavigationTarget } from '../domain/books';
import {
  PaginatedReaderDisplay,
  type PaginatedCommandIds,
  type PaginatedReaderBook,
  type ReaderDisplaySettings
} from '../presentation/reader/PaginatedReaderDisplay';
import { ImagePreviewPanel } from '../presentation/reader/ImagePreviewPanel';
import { getReaderDisplaySettings } from '../presentation/reader/ReaderDisplaySettings';
import type { BookReaderController, ReaderServices } from './BookFormat';

export abstract class PaginatedReaderBase<
  TBook extends PaginatedReaderBook,
  TExtraction,
  TImage
> implements BookReaderController {
  protected currentReader?: TBook;
  protected readonly terminal: PaginatedReaderDisplay;
  protected readonly imagePreview = new ImagePreviewPanel();
  private readonly subscriptions: Disposable[] = [];
  private openGeneration = 0;
  private disposed = false;

  protected constructor(
    protected readonly bookData: BookData,
    protected readonly services: ReaderServices,
    commandIds: PaginatedCommandIds
  ) {
    this.terminal = new PaginatedReaderDisplay(commandIds, services.readerSurface);
    this.subscriptions.push(
      this.terminal.onDidConcealContent(() => this.imagePreview.close()),
      commands.registerCommand(commandIds.next, () => this.next()),
      commands.registerCommand(commandIds.prev, () => this.prev()),
      commands.registerCommand(commandIds.jump, () => this.jump()),
      commands.registerCommand(commandIds.stop, () => this.stop()),
      commands.registerCommand(commandIds.viewImage, () => this.viewImage())
    );
  }

  get book(): BookData {
    return this.bookData;
  }

  get current(): TBook | undefined {
    return this.currentReader;
  }

  async open(): Promise<boolean> {
    this.onOpenStart();
    const generation = ++this.openGeneration;

    try {
      const extraction = await this.loadExtraction(this.bookData);
      if (generation !== this.openGeneration) {
        return false;
      }

      const syncedBook = this.syncBook(this.bookData, extraction);
      this.currentReader = this.createReader(syncedBook, extraction);
      this.terminal.bind(this.currentReader, this.getTerminalSettings());
      this.terminal.reveal();
      this.services.notifier.info(
        `Switch to ${this.services.privacyDisplay.getBookMessageName(this.bookData)} !`
      );
      return true;
    } catch (error) {
      if (generation !== this.openGeneration) {
        return false;
      }

      const text = error instanceof Error ? error.message : this.openErrorMessage;
      this.services.notifier.error(text);
      this.imagePreview.close();
      this.currentReader = undefined;
      this.terminal.unbind();
      return false;
    }
  }

  async next(): Promise<void> {
    const reader = this.currentReader;
    if (reader?.next(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount())) {
      this.terminal.render();
    }
  }

  async prev(): Promise<void> {
    const reader = this.currentReader;
    if (reader?.prev(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount())) {
      this.terminal.render();
    }
  }

  async close(): Promise<void> {
    this.stop(false);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.terminal.dispose();
  }

  async previous(): Promise<void> {
    await this.prev();
  }

  async viewImage(): Promise<void> {
    if (this.imagePreview.isOpen) {
      this.imagePreview.close();
      return;
    }
    if (!this.currentReader || !this.terminal.isRealContentMode()) {
      return;
    }

    const images = this.getImagesInView();
    if (images.length === 0) {
      this.services.notifier.info('当前页没有图片');
      return;
    }

    const target = images.length === 1 ? images[0] : await this.pickImage(images);
    if (target) {
      await this.showImage(target);
    }
  }

  async jumpTo(target: BookNavigationTarget): Promise<void> {
    if (target.kind === 'section') {
      this.jumpToSection(target.sectionIndex);
    }
  }

  refreshPrivacyDisplay(): void {
    this.imagePreview.close();
    this.refreshSettings();
  }

  refreshSettings(): void {
    if (!this.currentReader) {
      return;
    }
    this.terminal.updateSettings(this.getTerminalSettings());
    this.terminal.render();
  }

  stop(showMessage = true): void {
    this.openGeneration += 1;
    this.onStop();
    this.stopReading(showMessage ? this.stopMessage : undefined);
  }

  protected stopReading(messageText?: string): void {
    this.imagePreview.close();
    this.currentReader = undefined;
    this.terminal.hide();
    this.dispose();
    if (messageText) {
      this.services.notifier.info(messageText);
    }
  }

  protected focusTerminalSoon(): void {
    this.terminal.focus();
    setTimeout(() => this.terminal.focus(), 50);
  }

  protected getTerminalSettings(): ReaderDisplaySettings {
    return getReaderDisplaySettings(this.services.templateService, this.services.privacyDisplay);
  }

  protected onOpenStart(): void {}

  protected onStop(): void {}

  protected abstract readonly openErrorMessage: string;
  protected abstract readonly stopMessage: string;
  protected abstract loadExtraction(book: BookData): Promise<TExtraction>;
  protected abstract syncBook(book: BookData, extraction: TExtraction): BookData;
  protected abstract createReader(book: BookData, extraction: TExtraction): TBook;
  protected abstract jump(): Promise<void>;
  protected abstract getImagesInView(): TImage[];
  protected abstract pickImage(images: TImage[]): Promise<TImage | undefined>;
  protected abstract showImage(image: TImage): Promise<void>;
  protected abstract jumpToSection(index: number): void;
  abstract readonly format: BookFormat;
}
