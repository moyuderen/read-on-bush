import { window, commands } from 'vscode';
import { type ExtensionContext } from 'vscode';
import path from 'path';
import { BookTreeProvider, BookTreeItem } from './BookTree';
import { ReadBook } from './ReadBook';
import { Book, BookData } from './Book';
import message from '../utils/message';
import { generateId } from '../utils/generateId';
import { Commands } from './Commands';
import { supportedBookExtensions } from './parsers';
import {
  BookStorage,
  GlobalStateBookStorage
} from './storage/BookStorage';

export class BookList {
  public app: ReadBook;
  public context: ExtensionContext;
  public books: BookData[];
  private readonly bookTreeProvider: BookTreeProvider;
  private readonly bookStorage: BookStorage;

  constructor(app: ReadBook, bookStorage: BookStorage = new GlobalStateBookStorage()) {
    this.app = app;
    this.context = app.context;
    this.bookStorage = bookStorage;
    this.books = this.bookStorage.getBooks();
    this.bookTreeProvider = new BookTreeProvider(this.books);
    this.context.subscriptions.push(
      window.registerTreeDataProvider('bookList', this.bookTreeProvider)
    );
    this.initCommands();
  }

  getBooks(): BookData[] {
    this.books = this.bookStorage.getBooks();
    return this.books;
  }

  initCommands() {
    commands.registerCommand(Commands.OpenBook, (event) => {
      this.openOnBook(event);
    });

    commands.registerCommand(Commands.DeleteBook, (event) => {
      this.deleteBook(event.id);
    });
  }

  openOnBook(book: BookTreeItem) {
    const { id, name, process, url } = book;
    this.app.readingBook = new Book({ id, name, process, url }, this.app);
  }

  updateBookTreeProvider() {
    this.bookTreeProvider.updateBooks(this.books);
  }

  deleteBook(id: string) {
    this.books = this.bookStorage.deleteBook(id);
    this.updateBookTreeProvider();
    message(`Delete successful !`);
  }

  updateBookList(id: string, process: number) {
    this.books = this.bookStorage.updateBookProcess(id, process);
    this.updateBookTreeProvider();
  }

  async addBook() {
    const files = await window.showOpenDialog({
      title: '选择书籍',
      filters: {
        file: supportedBookExtensions
      }
    });
    if (files && files.length > 0) {
      const file = files[0];
      const book = {
        name: path.parse(file.path).base,
        id: generateId(),
        process: 0,
        url: file.fsPath
      };
      this.books = this.bookStorage.addBook(book);
      this.updateBookTreeProvider();
    }
  }
}
