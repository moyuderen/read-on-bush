import { window } from 'vscode';
import { Commands } from '../../config/commands';
import type { BookData, BookFormat } from '../../domain/books';
import { PaginatedReaderBase } from '../PaginatedReaderBase';
import { CachedExtractionLoader } from '../CachedExtractionLoader';
import type { ReaderServices } from '../BookFormat';
import { PdfBook, type PdfImageInView } from '../../domain/books/PdfBook';
import {
  extractPdf,
  readPdfImageBytes,
  toPageRefs,
  type PdfExtraction,
  type PdfImageBytes
} from '../../infrastructure/parsers/PdfExtractor';

/**
 * pdf 阅读控制器：串联 PdfBook（阅读模型）+ PaginatedReaderDisplay（epub/pdf 共用的伪装终端）+
 * pdf 命令 + 提取缓存加载。与 EpubReader 角色平行，也无视全局 displayTarget——永远走自己的终端。
 * 图片按需解码（readPdfImageBytes），解码结果按 book 内存缓存。
 */
export class PdfReader extends PaginatedReaderBase<PdfBook, PdfExtraction, PdfImageInView> {
  readonly format: BookFormat = 'pdf';
  protected readonly openErrorMessage = 'Open pdf failed';
  protected readonly stopMessage = 'Stop pdf reading';
  // 解码后的图片字节按「页:图序」缓存，避免重复解码；切换书时清空。
  private readonly imageCache = new Map<string, PdfImageBytes>();
  private readonly extractionLoader: CachedExtractionLoader<PdfExtraction>;
  private static readonly maxCachedImages = 8;

  constructor(
    book: BookData,
    services: ReaderServices,
    extractionLoader: CachedExtractionLoader<PdfExtraction>
  ) {
    super(book, services, {
      next: Commands.PdfNext,
      prev: Commands.PdfPrev,
      jump: Commands.PdfJumpPage,
      stop: Commands.PdfStop,
      viewImage: Commands.PdfViewImage
    });
    this.extractionLoader = extractionLoader;
  }

  protected syncBook(book: BookData, extraction: PdfExtraction): BookData {
    return this.services.bookCatalog.syncChapters(book.id, toPageRefs(extraction)) ?? book;
  }

  protected createReader(book: BookData, extraction: PdfExtraction): PdfBook {
    return new PdfBook(
      book,
      { progress: this.services.bookCatalog, notifier: this.services.notifier },
      extraction
    );
  }

  protected onOpenStart(): void {
    this.imageCache.clear();
  }

  protected onStop(): void {
    this.imageCache.clear();
  }

  protected async jump(): Promise<void> {
    if (!this.currentReader) {
      return;
    }
    const total = this.currentReader.extraction.pages.length;
    const items = this.currentReader.extraction.pages.map((page, index) => ({
      label: this.services.privacyDisplay.isPrivate ? `第 ${index + 1} 页` : page.title,
      description: `${index + 1} / ${total}`,
      index
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '跳转到页面' });
    if (picked) {
      this.currentReader.jumpToPage(picked.index);
      this.terminal.render();
    }
  }

  /** 跳转到指定页（书籍已由 ReadingSession 打开）。 */
  jumpToSection(index: number): void {
    if (!this.currentReader) {
      return;
    }
    this.currentReader.jumpToPage(index);
    this.terminal.render();
  }

  protected getImagesInView(): PdfImageInView[] {
    if (!this.currentReader) {
      return [];
    }
    return this.currentReader.getImagesInView(
      this.terminal.getEffectiveLineWidth(),
      this.terminal.getLineCount()
    );
  }

  protected async pickImage(images: PdfImageInView[]): Promise<PdfImageInView | undefined> {
    const items = images.map((image, index) => ({
      label: `图 ${index + 1}`,
      description: `第 ${image.pageIndex + 1} 页`,
      image
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '选择要查看的图片' });
    return picked?.image;
  }

  protected async showImage(target: PdfImageInView): Promise<void> {
    const book = this.currentReader?.book;
    if (!book) {
      return;
    }
    const cacheKey = `${target.pageIndex}:${target.imageIndex}`;
    let decoded = this.imageCache.get(cacheKey);
    if (!decoded) {
      decoded = await readPdfImageBytes(book.url, target.pageIndex, target.imageIndex);
      if (decoded) {
        this.cacheImage(cacheKey, decoded);
      }
    }
    if (!this.currentReader || this.currentReader.book.id !== book.id || !this.terminal.isRealContentMode()) {
      return;
    }
    if (!decoded) {
      this.services.notifier.error('读取图片失败');
      return;
    }
    const base64 = Buffer.from(decoded.bytes).toString('base64');
    this.imagePreview.show({
      title: this.services.privacyDisplay.getImageTitle(book),
      mediaType: decoded.mediaType,
      base64,
      onToggleDebug: () => this.terminal.toggleDebugContent(),
      onRefocus: () => this.focusTerminalSoon()
    });
  }

  private cacheImage(key: string, image: PdfImageBytes): void {
    this.imageCache.delete(key);
    this.imageCache.set(key, image);

    while (this.imageCache.size > PdfReader.maxCachedImages) {
      const oldestKey = this.imageCache.keys().next().value;
      if (oldestKey === undefined) {
        return;
      }
      this.imageCache.delete(oldestKey);
    }
  }

  protected loadExtraction(book: BookData): Promise<PdfExtraction> {
    return this.extractionLoader.load(book);
  }
}
