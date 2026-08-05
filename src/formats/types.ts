import type { ExtensionContext } from 'vscode';
import type { BookData, BookFormat, BookNavigationTarget, BookOutlineItem } from '../domain/books';
import type { ReadBook } from '../core/ReadBook';

export type ImportBookInput = {
  id: string;
  name: string;
  filePath: string;
  context: ExtensionContext;
  displayName?: string;
};

export type CreateReaderInput = {
  book: BookData;
  app: ReadBook;
};

export interface BookReaderController {
  readonly book: BookData;
  readonly format: BookFormat;

  open(): Promise<void>;
  close(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  jumpTo?(target: BookNavigationTarget): Promise<void>;
  refreshSettings?(): void;
  refreshPrivacyDisplay?(): void;
}

export interface BookFormatProvider {
  readonly format: BookFormat;
  readonly supportedExtensions: readonly string[];

  importBook(input: ImportBookInput): Promise<BookData>;
  createReader(input: CreateReaderInput): Promise<BookReaderController>;
  getOutline?(book: BookData): Promise<BookOutlineItem[]>;
  deleteCache?(book: BookData, context: ExtensionContext): Promise<void>;
}
