import { type ExtensionContext } from 'vscode';
import { BookList } from './BookList';
import { Book } from './Book';
import { ReadingDisplayManager } from './display';

export class ReadBook {
  public context: ExtensionContext;
  public bookList: BookList;
  public readingBook!: Book;
  public displayManager: ReadingDisplayManager;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.displayManager = new ReadingDisplayManager(context);
    this.bookList = new BookList(this);
  }
}
