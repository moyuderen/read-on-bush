import { window, commands } from 'vscode';
import { type ExtensionContext } from 'vscode';
import { BookTreeProvider, BookTreeItem } from './BookTree';
import { ReadBook } from './ReadBook';
import { Book, BookData } from './Book';
import message from '../utils/message';
import { getStorage, setStorage, rmStorage } from '../utils/storage';
import { importFile } from './Import';
import { generateId } from '../utils/generateId';

export let readingBook: Book;
export class BookList {
  public context: ExtensionContext;
  public readingBook: Book | null;
  public books: BookData[];

  constructor(context: ExtensionContext) {
    this.context = context;
    this.readingBook = null;
    importFile(this.context, () => this.addBook());
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
    this.readingBook = new Book(
      this.context, 
      { id, name, process, url },
      this
    );
    readingBook = this.readingBook;
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
        name: file.path,
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

export default {
  install(app: ReadBook) {
    app.bookList = new BookList(app.context);
    return app;
  }
};