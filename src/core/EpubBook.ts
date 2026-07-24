import message from '../utils/message';
import type { ReadBook } from './ReadBook';
import type { BookData, EpubProgress } from './Book';
import type { EpubExtraction, EpubImage } from './parsers/EpubExtractor';
import {
  buildProgressLabel,
  nextScreenStart,
  sameProgress,
  screenBefore,
  screenFrom,
  wrapChapter,
  type WrappedChapter
} from './epubPagination';

/**
 * epub 阅读模型。与 txt 的 Book 平行，但：
 * - 内容是 EpubExtraction（章节结构），不是扁平 string[]；
 * - 进度是 { chapterIndex, charOffset }，不是整数 process；
 * - 翻页基于 epubPagination（跨章自动流入、前后对称）。
 *
 * 分页所需的 lineWidth/lineCount 由调用方（epub 终端）按当前终端尺寸在渲染时传入。
 */
export class EpubBook {
  public app: ReadBook;
  public book: BookData;
  public extraction: EpubExtraction;
  public isReading: boolean;
  private readonly chapterStartOffsets: number[];
  private readonly totalChars: number;
  private readonly wrappedChapterCache = new Map<string, WrappedChapter>();
  private progress: EpubProgress;

  constructor(book: BookData, app: ReadBook, extraction: EpubExtraction) {
    this.app = app;
    this.book = book;
    this.extraction = extraction;
    this.isReading = true;
    const metrics = this.createChapterMetrics(extraction);
    this.chapterStartOffsets = metrics.chapterStartOffsets;
    this.totalChars = metrics.totalChars;
    const normalizedProgress = this.normalizeProgress(book.epubProgress);
    this.progress = normalizedProgress;
    if (!book.epubProgress || !sameProgress(book.epubProgress, normalizedProgress)) {
      this.book.epubProgress = normalizedProgress;
      this.app.bookList.updateEpubProgress(this.book.id, normalizedProgress);
    }
  }

  getProgress(): EpubProgress {
    return this.progress;
  }

  /** 进度文案：章号 + 章节标题 + 全书百分比，喂给共享的 formatCamouflageScreen。 */
  getProgressLabel(): string {
    return buildProgressLabel(
      this.extraction,
      this.progress,
      this.chapterStartOffsets,
      this.totalChars
    );
  }

  /** 当前屏：要显示的行 + 屏内图片 + 进度文案（一次 screenFrom 调用）。 */
  getScreen(lineWidth: number, lineCount: number): {
    lines: string[];
    images: EpubImage[];
    progressLabel: string;
  } {
    const { lines, endProgress } = screenFrom(
      this.extraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );
    return {
      lines,
      images: this.collectImagesInRange(this.progress, endProgress),
      progressLabel: this.getProgressLabel()
    };
  }

  getImagesInView(lineWidth: number, lineCount: number): EpubImage[] {
    const { endProgress } = screenFrom(
      this.extraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );
    return this.collectImagesInRange(this.progress, endProgress);
  }

  private getWrappedChapter(chapterIndex: number, lineWidth: number): WrappedChapter {
    const cacheKey = `${chapterIndex}:${lineWidth}`;
    const cached = this.wrappedChapterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const wrapped = wrapChapter(this.extraction.chapters[chapterIndex].text, lineWidth);
    this.wrappedChapterCache.set(cacheKey, wrapped);
    return wrapped;
  }

  private collectImagesInRange(start: EpubProgress, end: EpubProgress): EpubImage[] {
    const { chapters } = this.extraction;
    const lastChapter = chapters.length - 1;
    const startChapter = Math.min(start.chapterIndex, lastChapter);
    const endChapter = Math.min(end.chapterIndex, lastChapter);
    const result: EpubImage[] = [];

    for (let chapterIndex = startChapter; chapterIndex <= endChapter; chapterIndex++) {
      for (const image of chapters[chapterIndex].images) {
        if (chapterIndex === startChapter && image.charOffset < start.charOffset) {
          continue;
        }
        if (chapterIndex === endChapter && image.charOffset >= end.charOffset) {
          continue;
        }
        result.push(image);
      }
    }

    return result;
  }

  next(lineWidth: number, lineCount: number): boolean {
    const start = nextScreenStart(
      this.extraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );
    if (!start) {
      message('已经是最后一页了');
      return false;
    }
    this.setProgress(start);
    return true;
  }

  prev(lineWidth: number, lineCount: number): boolean {
    const { startProgress } = screenBefore(
      this.extraction,
      this.progress,
      lineWidth,
      lineCount,
      (chapterIndex) => this.getWrappedChapter(chapterIndex, lineWidth)
    );
    if (sameProgress(startProgress, this.progress)) {
      message('已经是第一页了');
      return false;
    }
    this.setProgress(startProgress);
    return true;
  }

  jumpToChapter(index: number): void {
    const lastIndex = Math.max(this.extraction.chapters.length - 1, 0);
    const chapterIndex = Math.min(Math.max(index, 0), lastIndex);
    this.setProgress({ chapterIndex, charOffset: 0 });
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

  private normalizeProgress(progress?: EpubProgress): EpubProgress {
    const lastIndex = Math.max(this.extraction.chapters.length - 1, 0);
    if (!progress) {
      return { chapterIndex: 0, charOffset: 0 };
    }
    const chapterIndex = Math.min(Math.max(progress.chapterIndex, 0), lastIndex);
    const chapter = this.extraction.chapters[chapterIndex];
    const maxOffset = Math.max(chapter.text.length, 0);
    const charOffset = Math.min(Math.max(progress.charOffset, 0), maxOffset);
    return { chapterIndex, charOffset };
  }

  private setProgress(progress: EpubProgress): void {
    this.progress = progress;
    this.book.epubProgress = progress;
    this.app.bookList.updateEpubProgress(this.book.id, progress);
  }
}
