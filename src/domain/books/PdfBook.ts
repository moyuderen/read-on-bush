import type {
  BookData,
  BookProgressPort,
  EpubProgress,
  PdfProgress,
  ReadingNotifier
} from '.';
import type { EpubExtraction, PdfExtraction } from '.';

/**
 * 屏内图片的视图信息：附带 pageIndex，供 PdfReader 按 i 时定位
 * readPdfImageBytes(filePath, pageIndex, imageIndex) 解码。
 */
export type PdfImageInView = {
  pageIndex: number;
  imageIndex: number;
  width?: number;
  height?: number;
};
import {
  buildProgressLabel,
  isEndOfBook,
  sameProgress,
  screenBefore,
  screenFrom,
  wrapChapter,
  type WrappedChapter
} from './EpubPagination';

/**
 * pdf 阅读模型。镜像 EpubBook，但复用 epub 的分页引擎——一页当作分页里的一个「章节」：
 * - 内部以 EpubProgress（chapterIndex = pageIndex）参与分页运算；
 * - 对外持久化用 PdfProgress（pageIndex / charOffset），二者仅字段名不同；
 * - 图片按页锚定（当前屏跨越的页范围内所有页的图），而非 epub 的 charOffset 锚定。
 *
 * 分页所需的 lineWidth/lineCount 由调用方（pdf 终端）按当前终端尺寸在渲染时传入。
 */
export type PdfBookDependencies = {
  progress: Pick<BookProgressPort, 'updatePdfProgress'>;
  notifier: ReadingNotifier;
};

export class PdfBook {
  public book: BookData;
  public extraction: PdfExtraction;
  private readonly paginationExtraction: EpubExtraction;
  private readonly chapterStartOffsets: number[];
  private readonly totalChars: number;
  private readonly wrappedChapterCache = new Map<string, WrappedChapter>();
  private readonly nextEmptyPage: number[];
  private progress: EpubProgress;

  constructor(
    book: BookData,
    private readonly dependencies: PdfBookDependencies,
    extraction: PdfExtraction
  ) {
    if (extraction.pages.length === 0) {
      throw new Error('Invalid pdf: no pages');
    }
    this.book = book;
    this.extraction = extraction;
    this.nextEmptyPage = this.buildNextEmptyPageIndex(extraction);
    // 复用 epub 分页引擎：把 pdf 页映射成 epub 章节形状（images 不参与分页，置空）。
    this.paginationExtraction = {
      bookTitle: extraction.bookTitle,
      chapters: extraction.pages.map((page) => ({ title: page.title, text: page.text, images: [] }))
    };
    const metrics = this.createChapterMetrics(this.paginationExtraction);
    this.chapterStartOffsets = metrics.chapterStartOffsets;
    this.totalChars = metrics.totalChars;
    const normalizedProgress = this.normalizeProgress(book.pdfProgress);
    this.progress = normalizedProgress;
    if (
      !book.pdfProgress ||
      book.pdfProgress.pageIndex !== normalizedProgress.chapterIndex ||
      book.pdfProgress.charOffset !== normalizedProgress.charOffset
    ) {
      const pdf = this.toPdfProgress(normalizedProgress);
      this.book.pdfProgress = pdf;
      this.dependencies.progress.updatePdfProgress(this.book.id, pdf);
    }
  }

  /** 进度文案：页标题（可选）+ 全书百分比，喂给共享的 formatCamouflageScreen。 */
  getProgressLabel(showChapterTitle = true): string {
    return buildProgressLabel(
      this.paginationExtraction,
      this.progress,
      this.chapterStartOffsets,
      this.totalChars,
      showChapterTitle
    );
  }

  /** 当前屏：要显示的行 + 屏内图片 + 进度文案。 */
  getScreen(lineWidth: number, lineCount: number): {
    lines: string[];
    images: PdfImageInView[];
  } {
    const { lines, endProgress } = this.screenFromCurrent(lineWidth, lineCount);
    return {
      lines,
      images: this.collectPageImages(this.progress, endProgress)
    };
  }

  getImagesInView(lineWidth: number, lineCount: number): PdfImageInView[] {
    const { endProgress } = this.screenFromCurrent(lineWidth, lineCount);
    return this.collectPageImages(this.progress, endProgress);
  }

  /**
   * PDF 空白页/纯图片页是有页码语义的，不能像 EPUB 空章节一样被流式分页跳过。
   * 当前页为空时返回独立空屏；后方遇到空页时，把它作为下一屏边界，不继续流入其后文本。
   */
  private screenFromCurrent(
    lineWidth: number,
    lineCount: number
  ): { lines: string[]; endProgress: EpubProgress; stoppedAtEmptyPage: boolean } {
    const currentPage = this.progress.chapterIndex;
    if (this.extraction.pages[currentPage].text.length === 0) {
      const nextPage = currentPage + 1;
      return {
        lines: [],
        endProgress:
          nextPage < this.extraction.pages.length
            ? { chapterIndex: nextPage, charOffset: 0 }
            : this.progress,
        stoppedAtEmptyPage: false
      };
    }

    const emptyPage = this.nextEmptyPage[currentPage];
    const paginationExtraction =
      emptyPage === -1
        ? this.paginationExtraction
        : {
            ...this.paginationExtraction,
            chapters: this.paginationExtraction.chapters.slice(0, emptyPage)
          };
    const result = screenFrom(
      paginationExtraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );

    if (emptyPage !== -1) {
      const pageBeforeEmpty = emptyPage - 1;
      const beforeTextLength = this.extraction.pages[pageBeforeEmpty].text.length;
      if (
        result.endProgress.chapterIndex === pageBeforeEmpty &&
        result.endProgress.charOffset >= beforeTextLength
      ) {
        return {
          lines: result.lines,
          endProgress: { chapterIndex: emptyPage, charOffset: 0 },
          stoppedAtEmptyPage: true
        };
      }
    }

    return { ...result, stoppedAtEmptyPage: false };
  }

  private getWrappedChapter(chapterIndex: number, lineWidth: number): WrappedChapter {
    const cacheKey = `${chapterIndex}:${lineWidth}`;
    const cached = this.wrappedChapterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const wrapped = wrapChapter(this.paginationExtraction.chapters[chapterIndex].text, lineWidth);
    this.wrappedChapterCache.set(cacheKey, wrapped);
    return wrapped;
  }

  /** 当前屏跨越的页范围内所有页的图（按页锚定，与 epub 的 charOffset 锚定不同）。 */
  private collectPageImages(start: EpubProgress, end: EpubProgress): PdfImageInView[] {
    const pages = this.extraction.pages;
    const lastPage = pages.length - 1;
    const startPage = Math.min(start.chapterIndex, lastPage);
    // endProgress 是“下一屏起点”。若它恰好位于下一页开头，则当前屏尚未覆盖该页。
    const endAtNextPageStart = end.chapterIndex > start.chapterIndex && end.charOffset === 0;
    const endPage = Math.min(end.chapterIndex - (endAtNextPageStart ? 1 : 0), lastPage);
    const result: PdfImageInView[] = [];

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      for (const image of pages[pageIndex].images) {
        result.push({
          pageIndex,
          imageIndex: image.index,
          width: image.width,
          height: image.height
        });
      }
    }

    return result;
  }

  next(lineWidth: number, lineCount: number): boolean {
    const currentPage = this.progress.chapterIndex;
    if (this.extraction.pages[currentPage].text.length === 0) {
      if (currentPage >= this.extraction.pages.length - 1) {
        this.dependencies.notifier.info('已经是最后一页了');
        return false;
      }
      this.setProgress({ chapterIndex: currentPage + 1, charOffset: 0 });
      return true;
    }

    const { endProgress, stoppedAtEmptyPage } = this.screenFromCurrent(lineWidth, lineCount);
    if (
      sameProgress(endProgress, this.progress) ||
      (!stoppedAtEmptyPage && isEndOfBook(this.paginationExtraction, endProgress))
    ) {
      this.dependencies.notifier.info('已经是最后一页了');
      return false;
    }
    this.setProgress(endProgress);
    return true;
  }

  prev(lineWidth: number, lineCount: number): boolean {
    const { startProgress } = screenBefore(
      this.paginationExtraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );
    // screenBefore 会跳过无文本章节；若本次回翻跨过空白页，应先停在最近的那一页。
    let emptyPage = -1;
    for (
      let pageIndex = this.progress.chapterIndex - 1;
      pageIndex >= startProgress.chapterIndex;
      pageIndex--
    ) {
      if (this.extraction.pages[pageIndex].text.length === 0) {
        emptyPage = pageIndex;
        break;
      }
    }
    const start =
      emptyPage === -1 ? startProgress : { chapterIndex: emptyPage, charOffset: 0 };
    if (sameProgress(start, this.progress)) {
      this.dependencies.notifier.info('已经是第一页了');
      return false;
    }
    this.setProgress(start);
    return true;
  }

  jumpToPage(index: number): void {
    const lastIndex = Math.max(this.extraction.pages.length - 1, 0);
    const chapterIndex = Math.min(Math.max(index, 0), lastIndex);
    this.setProgress({ chapterIndex, charOffset: 0 });
  }

  private buildNextEmptyPageIndex(extraction: PdfExtraction): number[] {
    const nextEmptyPage = Array<number>(extraction.pages.length).fill(-1);
    let nextEmpty = -1;

    for (let pageIndex = extraction.pages.length - 1; pageIndex >= 0; pageIndex--) {
      nextEmptyPage[pageIndex] = nextEmpty;
      if (extraction.pages[pageIndex].text.length === 0) {
        nextEmpty = pageIndex;
      }
    }

    return nextEmptyPage;
  }

  private createChapterMetrics(extraction: EpubExtraction): {
    chapterStartOffsets: number[];
    totalChars: number;
  } {
    let totalChars = 0;
    const chapterStartOffsets = extraction.chapters.map((chapter) => {
      const startOffset = totalChars;
      totalChars += chapter.text.length;
      return startOffset;
    });

    return { chapterStartOffsets, totalChars };
  }

  private normalizeProgress(progress?: PdfProgress): EpubProgress {
    const lastIndex = Math.max(this.extraction.pages.length - 1, 0);
    if (!progress) {
      return { chapterIndex: 0, charOffset: 0 };
    }
    const chapterIndex = Math.min(Math.max(progress.pageIndex, 0), lastIndex);
    const page = this.extraction.pages[chapterIndex];
    const maxOffset = Math.max(page.text.length, 0);
    const charOffset = Math.min(Math.max(progress.charOffset, 0), maxOffset);
    return { chapterIndex, charOffset };
  }

  private toPdfProgress(progress: EpubProgress): PdfProgress {
    return { pageIndex: progress.chapterIndex, charOffset: progress.charOffset };
  }

  private setProgress(progress: EpubProgress): void {
    this.progress = progress;
    const pdf = this.toPdfProgress(progress);
    this.book.pdfProgress = pdf;
    this.dependencies.progress.updatePdfProgress(this.book.id, pdf);
  }
}
