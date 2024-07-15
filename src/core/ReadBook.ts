import { type ExtensionContext, commands } from 'vscode';
import { BookList } from './BookList';
import { Book } from './Book';

export class ReadBook {
  public context: ExtensionContext;
  public bookList: BookList;
  public readingBook!: Book;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.bookList = new BookList(this);
  }
}
