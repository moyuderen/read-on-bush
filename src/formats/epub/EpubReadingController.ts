import type { BookData, BookFormat, BookNavigationTarget } from '../../domain/books';
import type { EpubReader } from '../../core/EpubReader';
import type { BookReaderController } from '../types';

export class EpubReadingController implements BookReaderController {
  readonly format: BookFormat = 'epub';

  constructor(readonly book: BookData, private readonly reader: EpubReader) {}

  async open(): Promise<void> {
    await this.reader.open(this.book);
  }

  async close(): Promise<void> {
    this.reader.stop(false);
  }

  async next(): Promise<void> {
    this.reader.next();
  }

  async previous(): Promise<void> {
    this.reader.prev();
  }

  async jumpTo(target: BookNavigationTarget): Promise<void> {
    if (target.kind === 'section') {
      this.reader.jumpToSection(target.sectionIndex);
    }
  }

  refreshSettings(): void {
    this.reader.refreshSettings();
  }
}
