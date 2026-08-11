import { window } from 'vscode';
import { Commands } from '../../config/commands';
import type { BookData, BookFormat } from '../../domain/books';
import { EpubBook } from '../../domain/books/EpubBook';
import { PaginatedReaderBase } from '../PaginatedReaderBase';
import { CachedExtractionLoader } from '../CachedExtractionLoader';
import type { ReaderServices } from '../BookFormat';
import {
  extractEpub,
  readEpubImageBytes,
  toChapterRefs,
  IMAGE_MEDIA_TYPES,
  SUPPORTED_IMAGE_MEDIA_TYPES,
  type EpubExtraction,
  type EpubImage
} from '../../infrastructure/parsers/EpubExtractor';

/**
 * epub 阅读控制器：串联 EpubBook（阅读模型）+ PaginatedReaderDisplay（epub/pdf 共用的伪装终端）+
 * epub 命令 + 提取缓存加载。与 txt 的 ReaderDisplayManager 角色平行，但 epub 无视
 * 全局 displayTarget——永远走自己的终端。
 */
export class EpubReader extends PaginatedReaderBase<EpubBook, EpubExtraction, EpubImage> {
  readonly format: BookFormat = 'epub';
  protected readonly openErrorMessage = 'Open epub failed';
  protected readonly stopMessage = 'Stop epub reading';
  private readonly extractionLoader: CachedExtractionLoader<EpubExtraction>;

  constructor(
    book: BookData,
    services: ReaderServices,
    extractionLoader: CachedExtractionLoader<EpubExtraction>
  ) {
    super(book, services, {
      next: Commands.EpubNext,
      prev: Commands.EpubPrev,
      jump: Commands.EpubJumpChapter,
      stop: Commands.EpubStop,
      viewImage: Commands.EpubViewImage
    });
    this.extractionLoader = extractionLoader;
  }

  protected async jump(): Promise<void> {
    if (!this.currentReader) {
      return;
    }
    const items = this.currentReader.extraction.chapters.map((chapter, index) => ({
      label: this.services.privacyDisplay.isPrivate
        ? `第 ${index + 1} 章`
        : chapter.title || `第 ${index + 1} 章`,
      description: `第 ${index + 1} 章`,
      index
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '跳转到章节' });
    if (picked) {
      this.currentReader.jumpToChapter(picked.index);
      this.terminal.render();
    }
  }

  protected syncBook(book: BookData, extraction: EpubExtraction): BookData {
    return this.services.bookCatalog.syncChapters(book.id, toChapterRefs(extraction)) ?? book;
  }

  protected createReader(book: BookData, extraction: EpubExtraction): EpubBook {
    return new EpubBook(
      book,
      { progress: this.services.bookCatalog, notifier: this.services.notifier },
      extraction
    );
  }

  protected loadExtraction(book: BookData): Promise<EpubExtraction> {
    return this.extractionLoader.load(book);
  }

  /** 跳转到指定章节（书籍已由 ReadingSession 打开）。 */
  jumpToSection(index: number): void {
    if (!this.currentReader) {
      return;
    }

    this.currentReader.jumpToChapter(index);
    this.terminal.render();
  }

  protected getImagesInView(): EpubImage[] {
    if (!this.currentReader) {
      return [];
    }
    return this.currentReader.getImagesInView(
      this.terminal.getEffectiveLineWidth(),
      this.terminal.getLineCount()
    );
  }

  protected async pickImage(images: EpubImage[]): Promise<EpubImage | undefined> {
    const items = images.map((image, index) => ({
      label: `图 ${index + 1}`,
      detail: image.zipPath,
      image
    }));
    const picked = await window.showQuickPick(items, { placeHolder: '选择要查看的图片' });
    return picked?.image;
  }

  protected async showImage(image: EpubImage): Promise<void> {
    const book = this.currentReader?.book;
    if (!book) {
      return;
    }
    const bytes = await readEpubImageBytes(book.url, image.zipPath);
    if (!this.currentReader || this.currentReader.book.id !== book.id || !this.terminal.isRealContentMode()) {
      return;
    }
    if (!bytes) {
      this.services.notifier.error('读取图片失败');
      return;
    }
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = getSafeImageMediaType(image.mediaType, image.zipPath);
    this.imagePreview.show({
      title: this.services.privacyDisplay.getImageTitle(book),
      mediaType,
      base64,
      onToggleDebug: () => this.terminal.toggleDebugContent(),
      onRefocus: () => this.focusTerminalSoon()
    });
  }

}

function getSafeImageMediaType(mediaType: string, zipPath: string): string {
  const normalized = mediaType.trim().toLowerCase();
  if (SUPPORTED_IMAGE_MEDIA_TYPES.has(normalized)) {
    return normalized;
  }

  return IMAGE_MEDIA_TYPES[zipPath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''] ?? 'application/octet-stream';
}
