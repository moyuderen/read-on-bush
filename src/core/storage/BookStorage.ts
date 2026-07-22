import { type BookData } from '../Book';
import { getStorage, setStorage } from '../../utils/storage';

const BOOKS_STORAGE_KEY = 'books';

export interface BookStorage {
  getBooks(): BookData[];
  saveBooks(books: BookData[]): void;
  addBook(book: BookData): BookData[];
  updateBookProcess(id: string, process: number): BookData[];
  deleteBook(id: string): BookData[];
}

export class GlobalStateBookStorage implements BookStorage {
  getBooks(): BookData[] {
    const books = getStorage(BOOKS_STORAGE_KEY);
    return Array.isArray(books) ? books : [];
  }

  saveBooks(books: BookData[]): void {
    setStorage(BOOKS_STORAGE_KEY, books);
  }

  addBook(book: BookData): BookData[] {
    const books = [...this.getBooks(), book];
    this.saveBooks(books);
    return books;
  }

  updateBookProcess(id: string, process: number): BookData[] {
    const books = this.getBooks();
    const book = books.find((book) => book.id === id);

    if (book) {
      book.process = process;
    }

    this.saveBooks(books);
    return books;
  }

  deleteBook(id: string): BookData[] {
    const books = this.getBooks().filter((book) => book.id !== id);
    this.saveBooks(books);
    return books;
  }
}
