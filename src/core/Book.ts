import { type ExtensionContext, type StatusBarItem, StatusBarAlignment,  window, commands } from 'vscode';
import { Parse } from './Parse';
import message from '../utils/message';
import { BookList } from './BookList';
import { updateContent, updateProcess } from './handler';

export type BookData = {
  id: string
  name: string
  process: number
  url: string
  children?: BookData[]
};
export class Book {
  public context: ExtensionContext;
  public bookList: BookList;
  public book: BookData;
  public contents: string[];

  constructor(context: ExtensionContext, book: BookData, bookList: BookList) {
    this.context = context;
    this.bookList = bookList;
    this.book = book;
    this.contents = [];
    const parse = new Parse(book.url);
    this.init(parse);
  }

  async init(parse: Parse) {
    const contents: string[] = await parse.start();
    this.contents = contents;
    const content = contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
  }

  prevLine() {
    if(this.book.process < 1) {
      message('已经是第一页了');
      return; 
    }
    this.book.process --;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
    this.bookList.updateBookList(this.book.id, this.book.process);
  }

  nextLine() {
     if(this.book.process >= this.contents.length) {
      message('已经是最后一页了');
      return; 
    }
    this.book.process ++;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
    this.bookList.updateBookList(this.book.id, this.book.process);
  }
}