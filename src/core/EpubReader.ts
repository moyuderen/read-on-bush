import fs from 'fs';
import { commands, window } from 'vscode';
import { Commands } from './Commands';
import message from '../utils/message';
import type { BookData } from './Book';
import type { ReadBook } from './ReadBook';
import { EpubBook } from './EpubBook';
import {
  extractEpub,
  readEpubImageBytes,
  IMAGE_MEDIA_TYPES,
  SUPPORTED_IMAGE_MEDIA_TYPES,
  type EpubExtraction,
  type EpubImage
} from './parsers/EpubExtractor';
import { EpubCache } from './storage/EpubCache';
import {
  PaginatedTerminalDisplay,
  type PaginatedTerminalDisplaySettings
} from './display/paginatedTerminalDisplay';
import { ImagePreviewPanel } from './display/imagePanel';
import {
  getShowChapterTitle,
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageTemplateSettings
} from './settings';

/**
 * epub 阅读控制器：串联 EpubBook（阅读模型）+ PaginatedTerminalDisplay（epub/pdf 共用的伪装终端）+
 * epub 命令 + 提取缓存加载。与 txt 的 ReadingDisplayManager 角色平行，但 epub 无视
 * 全局 displayTarget——永远走自己的终端。
 */
export class EpubReader {
  private epubBook?: EpubBook;
  private readonly terminal: PaginatedTerminalDisplay;
  private readonly imagePreview = new ImagePreviewPanel();

  constructor(private readonly app: ReadBook) {
    this.terminal = new PaginatedTerminalDisplay(app.context, {
      next: Commands.EpubNext,
      prev: Commands.EpubPrev,
      jump: Commands.EpubJumpChapter,
      stop: Commands.EpubStop,
      viewImage: Commands.EpubViewImage
    });
    app.context.subscriptions.push(
      this.terminal.onDidConcealContent(() => this.imagePreview.close())
    );
    this.initCommands();
  }

  get current(): EpubBook | undefined {
    return this.epubBook;
  }

  private initCommands(): void {
    this.app.context.subscriptions.push(
      commands.registerCommand(Commands.EpubNext, () => this.next()),
      commands.registerCommand(Commands.EpubPrev, () => this.prev()),
      commands.registerCommand(Commands.EpubJumpChapter, () => this.jumpChapter()),
      commands.registerCommand(Commands.EpubStop, () => this.stop()),
      commands.registerCommand(Commands.EpubViewImage, () => this.viewImage())
    );
  }

  async open(book: BookData): Promise<void> {
    try {
      const extraction = await this.loadExtraction(book);
      const syncedBook = this.app.bookList.syncEpubChapters(book.id, extraction) ?? book;
      this.epubBook = new EpubBook(syncedBook, this.app, extraction);
      this.terminal.bind(this.epubBook, this.getTerminalSettings());
      this.terminal.reveal();
      message(`Switch to 《${book.name}》 !`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Open epub failed';
      message.error(text);
      this.imagePreview.close();
      this.epubBook = undefined;
      this.terminal.unbind();
    }
  }

  next(): void {
    if (!this.epubBook) {
      return;
    }
    this.epubBook.next(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount());
    this.terminal.render();
  }

  prev(): void {
    if (!this.epubBook) {
      return;
    }
    this.epubBook.prev(this.terminal.getEffectiveLineWidth(), this.terminal.getLineCount());
    this.terminal.render();
  }

  async jumpChapter(): Promise<void> {
    if (!this.epubBook) {
      return;
    }
    const items = this.epubBook.extraction.chapters.map((chapter, index) => ({
      label: chapter.title || `第 ${index + 1} 章`,
      description: `第 ${index + 1} 章`,
      index
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '跳转到章节' });
    if (picked) {
      this.epubBook.jumpToChapter(picked.index);
      this.terminal.render();
    }
  }

  /** 跳转到指定章节（书籍已由 ReadingSessionService 打开）。 */
  jumpToSection(index: number): void {
    if (!this.epubBook) {
      return;
    }

    this.epubBook.jumpToChapter(index);
    this.terminal.render();
  }

  stop(showMessage = true): void {
    this.imagePreview.close();
    this.epubBook = undefined;
    this.terminal.hide();
    if (showMessage) {
      message('Stop epub reading');
    }
  }

  /** 查看当前屏内的图片：再次触发（如按 i）一键关闭，便于旁有人时迅速隐蔽。 */
  async viewImage(): Promise<void> {
    if (this.imagePreview.isOpen) {
      this.imagePreview.close();
      return;
    }
    if (!this.epubBook || !this.terminal.isRealContentMode()) {
      return;
    }
    const images = this.epubBook.getImagesInView(
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

  private async pickImage(images: EpubImage[]): Promise<EpubImage | undefined> {
    const items = images.map((image, index) => ({
      label: `图 ${index + 1}`,
      detail: image.zipPath,
      image
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '选择要查看的图片' });
    return picked?.image;
  }

  private async showImage(image: EpubImage): Promise<void> {
    const book = this.epubBook?.book;
    if (!book) {
      return;
    }
    const bytes = await readEpubImageBytes(book.url, image.zipPath);
    if (!this.epubBook || this.epubBook.book.id !== book.id || !this.terminal.isRealContentMode()) {
      return;
    }
    if (!bytes) {
      message.error('读取图片失败');
      return;
    }
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = getSafeImageMediaType(image.mediaType, image.zipPath);
    this.imagePreview.show({
      title: `《${book.name}》图片`,
      mediaType,
      base64,
      onToggleDebug: () => this.terminal.toggleDebugContent(),
      onRefocus: () => this.focusTerminalSoon()
    });
  }

  private focusTerminalSoon(): void {
    this.terminal.focus();
    setTimeout(() => this.terminal.focus(), 50);
  }

  /** 终端伪装样式 / 宽度 / 行数配置变更时刷新。 */
  refreshSettings(): void {
    if (!this.epubBook) {
      return;
    }
    this.terminal.updateSettings(this.getTerminalSettings());
    this.terminal.render();
  }

  private getTerminalSettings(): PaginatedTerminalDisplaySettings {
    return {
      template: this.app.templateService.resolve(getTerminalCamouflageTemplateSettings()),
      lineWidth: getTerminalCamouflageLineWidth(),
      lineCount: getTerminalCamouflageLineCount(),
      showChapterTitle: getShowChapterTitle()
    };
  }

  private async loadExtraction(book: BookData): Promise<EpubExtraction> {
    const stat = await fs.promises.stat(book.url);
    const cache = EpubCache.create(this.app.context.globalStorageUri);
    const cached = await cache.get(book.id, stat.mtimeMs);
    if (cached) {
      return cached;
    }
    const extraction = await extractEpub(book.url);
    await cache.set(book.id, stat.mtimeMs, extraction);
    return extraction;
  }
}

function getSafeImageMediaType(mediaType: string, zipPath: string): string {
  const normalized = mediaType.trim().toLowerCase();
  if (SUPPORTED_IMAGE_MEDIA_TYPES.has(normalized)) {
    return normalized;
  }

  return IMAGE_MEDIA_TYPES[zipPath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''] ?? 'application/octet-stream';
}
