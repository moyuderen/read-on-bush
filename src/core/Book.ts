import message from '../utils/message';
import { ReadBook } from './ReadBook';
import type { ReadingDisplayState } from './display';
import { createBookParser } from './parsers';
import { getLineWidth, getTxtEncoding } from './settings';
import type { BookData } from '../domain/books';

export type { BookData, BookFormat, ChapterRef, EpubProgress, PdfProgress } from '../domain/books';

export class Book {
  public app: ReadBook;
  public book: BookData;
  public contents: string[];
  public isReading!: boolean;
  private inited: boolean;

  constructor(book: BookData, app: ReadBook) {
    this.app = app;
    this.book = book;
    this.contents = [];
    this.isReading = true;
    this.inited = false;
    this.init();
  }

  async init() {
    try {
      const parser = createBookParser(this.book.url, {
        lineWidth: getLineWidth(),
        encoding: getTxtEncoding()
      });
      const contents: string[] = await parser.readContent();
      this.contents = contents;
      // 兼容 分段算法导致的文件最大值改变
      this.book.process = Math.min(this.book.process, Math.max(this.contents.length - 1, 0));
      message(`Switch to ${this.app.privacyDisplay.getBookMessageName(this.book)} !`);
      this.inited = true;
      this.renderCurrentContent();
    } catch (e: any) {
      message.error(e.message || 'Parse book failed !');
      this.inited = false;
    }
  }

  prevLine() {
    if (!this.isReading) {
      return;
    }

    if (!this.inited) {
      message.warn(`${this.app.privacyDisplay.getBookMessageName(this.book)}Initializing failed !`);
      return;
    }

    if (this.book.process < 1) {
      message('已经是第一页了');
      return;
    }
    const step = this.app.displayManager.getPrevProcessStep(this.getDisplayState());
    this.setProcess(this.book.process - step);
  }

  nextLine() {
    if (!this.isReading) {
      return;
    }

    if (!this.inited) {
      message.warn(`${this.app.privacyDisplay.getBookMessageName(this.book)}Initializing failed !`);
      return;
    }

    if (this.book.process >= this.contents.length - 1) {
      message('已经是最后一页了');
      return;
    }
    const step = this.app.displayManager.getNextProcessStep(this.getDisplayState());
    this.setProcess(this.book.process + step);
  }

  jumpLine(process: number) {
    if (!this.isReading) {
      return;
    }

    if (!this.inited) {
      message.warn(`${this.app.privacyDisplay.getBookMessageName(this.book)}Initializing failed !`);
      return;
    }

    this.setProcess(process);
  }

  getDisplayState(): ReadingDisplayState {
    return {
      content: this.contents[this.book.process] || '',
      contents: this.contents,
      book: this.book,
      process: this.book.process,
      total: this.contents.length,
      isReading: this.isReading
    };
  }

  pause() {
    this.isReading = false;
    this.app.displayManager.pause(this.getDisplayState());
  }

  start() {
    this.isReading = true;
    this.renderCurrentContent();
  }

  private setProcess(process: number) {
    const maxProcess = Math.max(this.contents.length - 1, 0);
    this.book.process = Math.min(Math.max(process, 0), maxProcess);
    this.renderCurrentContent();
    this.app.bookList.updateBookList(this.book.id, this.book.process);
  }

  private renderCurrentContent() {
    this.app.displayManager.render(this.getDisplayState());
  }
}
