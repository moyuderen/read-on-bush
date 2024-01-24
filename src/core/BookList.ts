import { window, commands } from 'vscode';
import { type ExtensionContext } from 'vscode';
import path from 'path';
import { BookTreeProvider, BookTreeItem } from './BookTree';
import { ReadBook } from './ReadBook';
import { Book, BookData } from './Book';
import message from '../utils/message';
import { getStorage, setStorage, rmStorage } from '../utils/storage';
import { generateId } from '../utils/generateId';

export class BookList {
  public app: ReadBook;
  public context: ExtensionContext;
  public books: BookData[];

  constructor(app: ReadBook) {
    this.app = app;
    this.context = app.context;
    this.books = this.getBooks();
    this.updateBookTreeProvider();
    this.initCommands();
  }

  getBooks() {
    // rmStorage('books');
    if(!getStorage('books') || getStorage('books') === undefined || getStorage('books') === 'undefined') {
      setStorage('books', []);
      return [];
    }
    return getStorage('books');
  }
  
  initCommands() {
    commands.registerCommand('readOnBush.openBook', (event) => {
      this.openOnBook(event);
    });

    commands.registerCommand('readOnBush.deleteEntry', event => {
      this.deleteBook(event.id);
    });
  }

  openOnBook(book: BookTreeItem) {
    const { id, name, process, label, url } = book;
    message(`Switch to ${label} !`);
    this.app.readingBook = new Book(
      { id, name, process, url },
      this.app
    );
  }

  updateBookTreeProvider() {
    const provider = new BookTreeProvider(this.books);
    provider.refresh();
    window.registerTreeDataProvider('bookList', provider);
  }

  deleteBook(id: string) {
    this.books = this.books.filter(book => book.id !== id);
    this.updateBookTreeProvider();
    setStorage('books', this.books);
    message(`Delete successful !`);
  }

  updateBookList(id: string, process: number) {
    this.books.forEach(book => {
      if(book.id === id) {
        book.process = process;
      }
    });
    this.updateBookTreeProvider();
    setStorage('books', this.books);
  }

  async addBook() {
    const files = await window.showOpenDialog({
      title: "选择书籍txt",
      filters: {
        'file': ['txt']
      },
    });
    if (files && files.length > 0) {
      const file = files[0];
      const book = {
        name: path.parse(file.path).base,
        id: generateId(),
        process: 0,
        url: file.path
      };
      this.books.push(book);
      this.updateBookTreeProvider();
      setStorage('books', this.books);
    }
  }
}