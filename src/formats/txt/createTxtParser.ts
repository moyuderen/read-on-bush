import type { BookData } from '../../domain/books';
import { normalizeBookTxtEncoding } from '../../domain/books/TxtEncoding';
import { createBookParser } from '../../infrastructure/parsers';
import { getLineWidth, getTxtEncoding } from '../../config/settings';

export function createConfiguredTxtParser(book: BookData) {
  return createBookParser(book.url, {
    lineWidth: getLineWidth(),
    encoding: normalizeBookTxtEncoding(book.txtEncoding) ?? getTxtEncoding()
  });
}
