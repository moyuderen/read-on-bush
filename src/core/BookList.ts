import { window, commands } from 'vscode';
import { type ExtensionContext } from 'vscode';
import path from 'path';
import { BookTreeProvider, BookTreeItem } from './BookTree';
import { ReadBook } from './ReadBook';
import { Book, BookData } from './Book';
import message from '../utils/message';
import { getStorage, setStorage } from '../utils/storage';
import { generateId } from '../utils/generateId';
import { Commands } from './Commands';

export class BookList {
  public app: ReadBook;
  public context: ExtensionContext;
  public books: BookData[];
  private readonly bookTreeProvider: BookTreeProvider;

  constructor(app: ReadBook) {
    this.app = app;
    this.context = app.context;
    this.books = this.getBooks();
    this.bookTreeProvider = new BookTreeProvider(this.books);
    this.context.subscriptions.push(
      window.registerTreeDataProvider('bookList', this.bookTreeProvider)
    );
    this.initCommands();
  }

  getBooks(): BookData[] {
    const books = getStorage('books');
    if (!books || books === undefined || books === 'undefined') {
      this.books = [];
      setStorage('books', this.books);
      return this.books;
    }

    this.books = books;
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
    this.bookTreeProvider.setBooks(this.books);
    this.bookTreeProvider.refresh();
  }

  deleteBook(id: string) {
    this.books = this.books.filter((book) => book.id !== id);
    this.updateBookTreeProvider();
    setStorage('books', this.books);
    message(`Delete successful !`);
  }

  updateBookList(id: string, process: number) {
    this.books.forEach((book) => {
      if (book.id === id) {
        book.process = process;
      }
    });
    this.updateBookTreeProvider();
    setStorage('books', this.books);
  }

  async addBook() {
    const files = await window.showOpenDialog({
      title: '选择书籍txt',
      filters: {
        file: ['txt']
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
      this.books.push(book);
      this.updateBookTreeProvider();
      setStorage('books', this.books);
    }
  }
}
