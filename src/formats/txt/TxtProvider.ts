import type { BookData, BookFormat } from '../../domain/books';
import type { SearchDocument } from '../../domain/search';
import { createTxtSearchDocument } from '../SearchDocumentBuilders';
import { createConfiguredTxtParser } from './createTxtParser';
import type { BookFormatProvider, CreateReaderInput, ImportBookInput } from '../BookFormat';
import { TxtReadingController } from './TxtReadingController';

export class TxtProvider implements BookFormatProvider {
  readonly format: BookFormat = 'txt';
  readonly supportedExtensions = ['txt'];

  async importBook(input: ImportBookInput): Promise<BookData> {
    return {
      name: input.name,
      id: input.id,
      process: 0,
      url: input.filePath,
      format: this.format
    };
  }

  createReader(input: CreateReaderInput): TxtReadingController {
    return new TxtReadingController(input.book, input.services);
  }

  async loadSearchDocument(book: BookData): Promise<SearchDocument> {
    const parser = createConfiguredTxtParser(book.url);
    const segments = await parser.readSearchSegments();
    return createTxtSearchDocument(book.id, segments);
  }
}
