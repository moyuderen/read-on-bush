import fs from 'fs';
import { commands, window, ViewColumn, type WebviewPanel } from 'vscode';
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
import { EpubTerminalDisplay } from './display/epubTerminalDisplay';
import {
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageStyle
} from './settings';

/**
 * epub 阅读控制器：串联 EpubBook（阅读模型）+ EpubTerminalDisplay（自有伪装终端）+
 * epub 命令 + 提取缓存加载。与 txt 的 ReadingDisplayManager 角色平行，但 epub 无视
 * 全局 displayTarget——永远走自己的终端。
 */
export class EpubReader {
  private epubBook?: EpubBook;
  private readonly terminal: EpubTerminalDisplay;
  private imagePanel?: WebviewPanel;

  constructor(private readonly app: ReadBook) {
    this.terminal = new EpubTerminalDisplay(app.context);
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
      this.terminal.bind(
        this.epubBook,
        getTerminalCamouflageStyle(),
        getTerminalCamouflageLineWidth(),
        getTerminalCamouflageLineCount()
      );
      this.terminal.reveal();
      message(`Switch to 《${book.name}》 !`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Open epub failed';
      message.error(text);
      this.closeImagePanel();
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
    this.closeImagePanel();
    this.epubBook = undefined;
    this.terminal.hide();
    if (showMessage) {
      message('Stop epub reading');
    }
  }

  /** 查看当前屏内的图片：再次触发（如按 i）一键关闭，便于旁有人时迅速隐蔽。 */
  async viewImage(): Promise<void> {
    if (this.imagePanel) {
      this.closeImagePanel();
      return;
    }
    if (!this.epubBook) {
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
    if (!bytes) {
      message.error('读取图片失败');
      return;
    }
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = getSafeImageMediaType(image.mediaType, image.zipPath);
    const panel = window.createWebviewPanel(
      'readOnBushEpubImage',
      `《${book.name}》图片`,
      ViewColumn.Active,
      { enableScripts: true }
    );
    panel.webview.html = buildImageHtml(mediaType, base64);
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg === 'close') {
        this.closeImagePanel();
      }
    });
    panel.onDidDispose(() => {
      this.imagePanel = undefined;
      // 关闭图片后焦点回到伪装终端，否则 i 键落不到终端、无法立即重开
      this.focusTerminalSoon();
    });
    this.imagePanel = panel;
  }

  private closeImagePanel(): void {
    const panel = this.imagePanel;
    if (!panel) {
      return;
    }
    this.imagePanel = undefined;
    panel.dispose();
    this.focusTerminalSoon();
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
    this.terminal.updateSettings(
      getTerminalCamouflageStyle(),
      getTerminalCamouflageLineWidth(),
      getTerminalCamouflageLineCount()
    );
    this.terminal.render();
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

function buildImageHtml(mediaType: string, base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body tabindex="0" style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;cursor:pointer;outline:none">
<img src="data:${mediaType};base64,${base64}" style="max-width:100%;max-height:100vh;object-fit:contain" />
<div style="position:fixed;bottom:8px;right:12px;color:#999;font-size:12px;pointer-events:none">按任意键 / 点击关闭</div>
<script>
  const vscode = acquireVsCodeApi();
  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    vscode.postMessage('close');
  };
  const focusBody = () => document.body.focus({ preventScroll: true });
  window.addEventListener('keydown', close, true);
  document.addEventListener('keydown', close, true);
  document.body.addEventListener('click', close);
  window.addEventListener('load', focusBody);
  setTimeout(focusBody, 0);
</script>
</body>
</html>`;
}
