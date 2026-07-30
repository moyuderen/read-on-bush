import fs from 'fs';
import message from '../../utils/message';
import type { BookData, BookFormat, BookOutlineItem } from '../../domain/books';
import { extractPdf, toPageRefs } from '../../core/parsers/PdfExtractor';
import { PdfCache } from '../../core/storage/PdfCache';
import type { BookFormatProvider, CreateReaderInput, ImportBookInput } from '../types';
import { PdfReadingController } from './PdfReadingController';

/**
 * pdf 格式 provider（对应 epub 的 EpubProvider）：
 * 导入即全文抽取 + 扫描图片元信息并缓存；创建 PdfReadingController；
 * 目录以页为节点（target = section）；删除时清缓存。
 */
export class PdfProvider implements BookFormatProvider {
  readonly format: BookFormat = 'pdf';
  readonly supportedExtensions = ['pdf'];

  async importBook(input: ImportBookInput): Promise<BookData> {
    const bookData: BookData = {
      name: input.name,
      id: input.id,
      process: 0,
      url: input.filePath,
      format: this.format,
      pdfProgress: { pageIndex: 0, charOffset: 0 }
    };

    try {
      const extraction = await extractPdf(bookData.url);
      bookData.chapters = toPageRefs(extraction);

      const stat = await fs.promises.stat(bookData.url);
      const cache = PdfCache.create(input.context.globalStorageUri);
      await cache.set(bookData.id, stat.mtimeMs, extraction);
    } catch (error) {
      const text = error instanceof Error ? error.message : '解析 pdf 失败';
      message.warn(`《${bookData.name}》${text}，仍已加入书架`);
    }

    return bookData;
  }

  async createReader(input: CreateReaderInput): Promise<PdfReadingController> {
    return new PdfReadingController(input.book, input.app.pdfReader);
  }

  async getOutline(book: BookData): Promise<BookOutlineItem[]> {
    return (book.chapters ?? []).map((chapter, index) => ({
      id: `${book.id}:section:${index}`,
      title: chapter.title,
      target: { kind: 'section', sectionIndex: index }
    }));
  }

  async deleteCache(book: BookData, context: ImportBookInput['context']): Promise<void> {
    await PdfCache.create(context.globalStorageUri).delete(book.id);
  }
}
