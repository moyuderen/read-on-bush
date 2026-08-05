import fs from 'fs';
import { commands, window } from 'vscode';
import { Commands } from './Commands';
import message from '../utils/message';
import type { BookData } from './Book';
import type { ReadBook } from './ReadBook';
import { PdfBook, type PdfImageInView } from './PdfBook';
import {
  extractPdf,
  readPdfImageBytes,
  type PdfExtraction,
  type PdfImageBytes
} from './parsers/PdfExtractor';
import { PdfCache } from './storage/PdfCache';
import {
  PaginatedTerminalDisplay,
  type PaginatedTerminalDisplaySettings
} from './display/paginatedTerminalDisplay';
import { ImagePreviewPanel } from './display/imagePanel';
import { getPaginatedTerminalDisplaySettings } from './display/paginatedTerminalSettings';

/**
 * pdf 阅读控制器：串联 PdfBook（阅读模型）+ PaginatedTerminalDisplay（epub/pdf 共用的伪装终端）+
 * pdf 命令 + 提取缓存加载。与 EpubReader 角色平行，也无视全局 displayTarget——永远走自己的终端。
 * 图片按需解码（readPdfImageBytes），解码结果按 book 内存缓存。
 */
export class PdfReader {
  private pdfBook?: PdfBook;
  private readonly terminal: PaginatedTerminalDisplay;
  private readonly imagePreview = new ImagePreviewPanel();
  // 解码后的图片字节按「页:图序」缓存，避免重复解码；切换书时清空。
  private readonly imageCache = new Map<string, PdfImageBytes>();

  constructor(private readonly app: ReadBook) {
    this.terminal = new PaginatedTerminalDisplay(app.context, {
      next: Commands.PdfNext,
      prev: Commands.PdfPrev,
      jump: Commands.PdfJumpPage,
      stop: Commands.PdfStop,
      viewImage: Commands.PdfViewImage
    });
    app.context.subscriptions.push(
      this.terminal.onDidConcealContent(() => this.imagePreview.close())
    );
    this.initCommands();
  }

  get current(): PdfBook | undefined {
    return this.pdfBook;
  }

  private initCommands(): void {
    this.app.context.subscriptions.push(
      commands.registerCommand(Commands.PdfNext, () => this.next()),
      commands.registerCommand(Commands.PdfPrev, () => this.prev()),
      commands.registerCommand(Commands.PdfJumpPage, () => this.jumpPage()),
      commands.registerCommand(Commands.PdfStop, () => this.stop()),
      commands.registerCommand(Commands.PdfViewImage, () => this.viewImage())
    );
  }

  async open(book: BookData): Promise<void> {
    this.imageCache.clear();
    try {
      const extraction = await this.loadExtraction(book);
      const syncedBook = this.app.bookList.syncPdfPages(book.id, extraction) ?? book;
      this.pdfBook = new PdfBook(syncedBook, this.app, extraction);
      this.terminal.bind(this.pdfBook, this.getTerminalSettings());
      this.terminal.reveal();
      message(`Switch to ${this.app.privacyDisplay.getBookMessageName(book)} !`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Open pdf failed';
      message.error(text);
      this.imagePreview.close();
      this.pdfBook = undefined;
      this.terminal.unbind();
    }
  }

  next(): void {
    if (!this.pdfBook) {
      return;
    }
    this.pdfBook.next(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount());
    this.terminal.render();
  }

  prev(): void {
    if (!this.pdfBook) {
      return;
    }
    this.pdfBook.prev(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount());
    this.terminal.render();
  }

  async jumpPage(): Promise<void> {
    if (!this.pdfBook) {
      return;
    }
    const total = this.pdfBook.extraction.pages.length;
    const items = this.pdfBook.extraction.pages.map((page, index) => ({
      label: this.app.privacyDisplay.isPrivate ? `第 ${index + 1} 页` : page.title,
      description: `${index + 1} / ${total}`,
      index
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '跳转到页面' });
    if (picked) {
      this.pdfBook.jumpToPage(picked.index);
      this.terminal.render();
    }
  }

  /** 跳转到指定页（书籍已由 ReadingSessionService 打开）。 */
  jumpToSection(index: number): void {
    if (!this.pdfBook) {
      return;
    }
    this.pdfBook.jumpToPage(index);
    this.terminal.render();
  }

  stop(showMessage = true): void {
    this.imagePreview.close();
    this.pdfBook = undefined;
    this.terminal.hide();
    if (showMessage) {
      message('Stop pdf reading');
    }
  }

  /** 查看当前屏内的图片：再次触发（如按 i）一键关闭，便于旁有人时迅速隐蔽。 */
  async viewImage(): Promise<void> {
    if (this.imagePreview.isOpen) {
      this.imagePreview.close();
      return;
    }
    if (!this.pdfBook || !this.terminal.isRealContentMode()) {
      return;
    }
    const images = this.pdfBook.getImagesInView(
      this.terminal.getEffectiveLineWidth(),
      this.terminal.getLineCount()
    );
    if (images.length === 0) {
      message('当前页没有图片');
      return;
    }
    const target = images.length === 1 ? images[0] : await this.pickImage(images);
    if (!target) {
      return;
    }
    await this.showImage(target);
  }

  private async pickImage(images: PdfImageInView[]): Promise<PdfImageInView | undefined> {
    const items = images.map((image, index) => ({
      label: `图 ${index + 1}`,
      description: `第 ${image.pageIndex + 1} 页`,
      image
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '选择要查看的图片' });
    return picked?.image;
  }

  private async showImage(target: PdfImageInView): Promise<void> {
    const book = this.pdfBook?.book;
    if (!book) {
      return;
    }
    const cacheKey = `${target.pageIndex}:${target.imageIndex}`;
    let decoded = this.imageCache.get(cacheKey);
    if (!decoded) {
      decoded = await readPdfImageBytes(book.url, target.pageIndex, target.imageIndex);
      if (decoded) {
        this.imageCache.set(cacheKey, decoded);
      }
    }
    if (!this.pdfBook || this.pdfBook.book.id !== book.id || !this.terminal.isRealContentMode()) {
      return;
    }
    if (!decoded) {
      message.error('读取图片失败');
      return;
    }
    const base64 = Buffer.from(decoded.bytes).toString('base64');
    this.imagePreview.show({
      title: this.app.privacyDisplay.getImageTitle(book),
      mediaType: decoded.mediaType,
      base64,
      onToggleDebug: () => this.terminal.toggleDebugContent(),
      onRefocus: () => this.focusTerminalSoon()
    });
  }

  private focusTerminalSoon(): void {
    this.terminal.focus();
    setTimeout(() => this.terminal.focus(), 50);
  }

  refreshPrivacyDisplay(): void {
    this.imagePreview.close();
    this.refreshSettings();
  }

  /** 终端伪装样式 / 宽度 / 行数配置变更时刷新。 */
  refreshSettings(): void {
    if (!this.pdfBook) {
      return;
    }
    this.terminal.updateSettings(this.getTerminalSettings());
    this.terminal.render();
  }

  private getTerminalSettings(): PaginatedTerminalDisplaySettings {
    return getPaginatedTerminalDisplaySettings(
      this.app.templateService,
      this.app.privacyDisplay
    );
  }

  private async loadExtraction(book: BookData): Promise<PdfExtraction> {
    const stat = await fs.promises.stat(book.url);
    const cache = PdfCache.create(this.app.context.globalStorageUri);
    const cached = await cache.get(book.id, stat.mtimeMs);
    if (cached) {
      return cached;
    }
    const extraction = await extractPdf(book.url);
    // 缓存写入只服务于下次打开，不应阻塞本次阅读；失败静默（不影响阅读）。
    void cache.set(book.id, stat.mtimeMs, extraction).catch(() => {
      /* 缓盘失败不影响阅读 */
    });
    return extraction;
  }
}
