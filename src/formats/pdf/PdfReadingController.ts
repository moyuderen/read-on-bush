import type { BookData, BookFormat, BookNavigationTarget } from '../../domain/books';
import type { PdfReader } from '../../core/PdfReader';
import type { BookReaderController } from '../types';

/**
 * pdf 阅读控制器适配层（对应 epub 的 EpubReadingController）：
 * 把 BookReaderController 接口转发给 PdfReader。
 */
export class PdfReadingController implements BookReaderController {
  readonly format: BookFormat = 'pdf';

  constructor(readonly book: BookData, private readonly reader: PdfReader) {}

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
