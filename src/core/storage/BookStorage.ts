import { type BookData } from '../Book';
import { getStorage, setStorage } from '../../utils/storage';

const BOOKS_STORAGE_KEY = 'books';

export interface BookStorage {
  getBooks(): BookData[];
  saveBooks(books: BookData[]): void;
  addBook(book: BookData): BookData[];
  addBooks(books: BookData[]): BookData[];
  updateBookProcess(id: string, process: number): BookData[];
  renameBook(id: string, name: string): BookData[];
  updateBookCategory(id: string, category?: string): BookData[];
  deleteBook(id: string): BookData[];
}

function normalizeBook(book: BookData, index: number): BookData {
  return {
    ...book,
    order: book.order ?? index,
    createdAt: book.createdAt ?? 0
  };
}

function normalizeCategory(category?: string): string | undefined {
  const value = category?.trim();
  return value ? value : undefined;
}

function isSameBook(left: BookData, right: BookData): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.process === right.process &&
    left.url === right.url &&
    left.category === right.category &&
    left.createdAt === right.createdAt &&
    left.order === right.order
  );
}

export class GlobalStateBookStorage implements BookStorage {
  getBooks(): BookData[] {
    const value = getStorage(BOOKS_STORAGE_KEY);
    const books = Array.isArray(value) ? (value as BookData[]) : [];
    const normalizedBooks = books.map(normalizeBook);

    if (normalizedBooks.some((book, index) => !isSameBook(book, books[index]))) {
      this.saveBooks(normalizedBooks);
    }

    return normalizedBooks;
  }

  saveBooks(books: BookData[]): void {
    setStorage(BOOKS_STORAGE_KEY, books.map(normalizeBook));
  }

  addBook(book: BookData): BookData[] {
    return this.addBooks([book]);
  }

  addBooks(nextBooks: BookData[]): BookData[] {
    const books = this.getBooks();
    const now = Date.now();
    const maxOrder = books.reduce((order, book) => Math.max(order, book.order ?? -1), -1);
    const normalizedNextBooks = nextBooks.map((book, index) =>
      normalizeBook(
        {
          ...book,
          createdAt: book.createdAt ?? now,
          order: book.order ?? maxOrder + index + 1,
          category: normalizeCategory(book.category)
        },
        books.length + index
      )
    );
    const allBooks = [...books, ...normalizedNextBooks];

    this.saveBooks(allBooks);
    return allBooks;
  }

  updateBookProcess(id: string, process: number): BookData[] {
    return this.updateBook(id, (book) => ({
      ...book,
      process
    }));
  }

  renameBook(id: string, name: string): BookData[] {
    const nextName = name.trim();
    return this.updateBook(id, (book) => ({
      ...book,
      name: nextName
    }));
  }

  updateBookCategory(id: string, category?: string): BookData[] {
    const nextCategory = normalizeCategory(category);
    return this.updateBook(id, (book) => ({
      ...book,
      category: nextCategory
    }));
  }

  deleteBook(id: string): BookData[] {
    const books = this.getBooks().filter((book) => book.id !== id);
    this.saveBooks(books);
    return books;
  }

  private updateBook(id: string, updater: (book: BookData) => BookData): BookData[] {
    const books = this.getBooks().map((book) => (book.id === id ? updater(book) : book));
    this.saveBooks(books);
    return books;
  }
}
