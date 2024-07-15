import { Parse } from './Parse';
import message from '../utils/message';
import { updateContent } from './barItems/content';
import { updateProgress } from './barItems/progress';
import { ReadBook } from './ReadBook';

export type BookData = {
  id: string
  name: string
  process: number
  url: string
  children?: BookData[]
};
export class Book {
  public app: ReadBook;
  public book: BookData;
  public contents: string[];
  public isReading!: boolean;

  constructor(book: BookData, app: ReadBook) {
    this.app = app;
    this.book = book;
    this.contents = [];
    this.isReading = true;
    this.init();
  }

  async init() {
    try {
      const parse = new Parse(this.book.url);
      const contents: string[] = await parse.readContent();
      this.contents = contents;
      const content = contents[this.book.process];
      message(`Switch to 《${this.book.name}》 !`);
      updateContent(content);
      updateProgress(this.book.process, this.contents.length, this.book);
    } catch(e: any) {
      message.error(e.message);
    }
  }

  prevLine() {
    if(!this.isReading) {
      return;
    }

    if(this.book.process < 1) {
      message('已经是第一页了');
      return; 
    }
    this.book.process --;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProgress(this.book.process, this.contents.length, this.book);
    this.app.bookList.updateBookList(this.book.id, this.book.process);
  }

  nextLine() {
    if(!this.isReading) {
      return;
    }

    if(this.book.process >= this.contents.length) {
      message('已经是最后一页了');
      return; 
    }
    this.book.process ++;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProgress(this.book.process, this.contents.length, this.book);
    this.app.bookList.updateBookList(this.book.id, this.book.process);
  }

  jumpLine(process: number) {
    if(!this.isReading) {
      return;
    }

    this.book.process = process;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProgress(this.book.process, this.contents.length, this.book);
    this.app.bookList.updateBookList(this.book.id, this.book.process);
  }

  pause() {
    this.isReading = false;
  }

  start() {
    this.isReading = true;
  }
}