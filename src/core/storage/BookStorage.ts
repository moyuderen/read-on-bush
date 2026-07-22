import { type BookData } from '../Book';
import { getStorage, setStorage } from '../../utils/storage';

const BOOKS_STORAGE_KEY = 'books';

export interface BookStorage {
  getBooks(): BookData[];
  saveBooks(books: BookData[]): void;
  updateBookProcess(id: string, process: number): BookData[];
  deleteBook(id: string): BookData[];
}

export class GlobalStateBookStorage implements BookStorage {
  private books: BookData[] = [];

  getBooks(): BookData[] {
    const books = getStorage(BOOKS_STORAGE_KEY);
    this.books = Array.isArray(books) ? books : [];
    return this.books;
  }

  saveBooks(books: BookData[]): void {
    this.books = books;
    setStorage(BOOKS_STORAGE_KEY, this.books);
  }

  updateBookProcess(id: string, process: number): BookData[] {
    const book = this.books.find((book) => book.id === id);

    if (book) {
      book.process = process;
    }

    this.saveBooks(this.books);
    return this.books;
  }

  deleteBook(id: string): BookData[] {
    this.books = this.books.filter((book) => book.id !== id);
    this.saveBooks(this.books);
    return this.books;
  }
}
