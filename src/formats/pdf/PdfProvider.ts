import { Uri } from 'vscode';
import type { BookData, BookFormat, BookOutlineItem } from '../../domain/books';
import {
  extractPdf,
  toPageRefs,
  type PdfExtraction
} from '../../infrastructure/parsers/PdfExtractor';
import { PdfCache } from '../../infrastructure/storage/PdfCache';
import type { BookFormatProvider, CreateReaderInput, ImportBookInput } from '../BookFormat';
import { CachedExtractionLoader } from '../CachedExtractionLoader';
import { createBookOutline, importCachedBook } from '../FormatProviderHelpers';
import { PdfReader } from './PdfReader';

/**
 * pdf 格式 provider（对应 epub 的 PdfProvider）：
 * 导入即全文抽取 + 扫描图片元信息并缓存；创建 PdfReader；
 * 目录以页为节点（target = section）；删除时清缓存。
 */
export class PdfProvider implements BookFormatProvider {
  readonly format: BookFormat = 'pdf';
  readonly supportedExtensions = ['pdf'];
  private readonly cache: PdfCache;
  private readonly extractionLoader: CachedExtractionLoader<PdfExtraction>;

  constructor(cacheDirectory: Uri = Uri.file(process.cwd())) {
    this.cache = PdfCache.create(cacheDirectory);
    this.extractionLoader = new CachedExtractionLoader(this.cache, extractPdf);
  }

  importBook(input: ImportBookInput): Promise<BookData> {
    return importCachedBook({
      input,
      createBook: (bookInput) => ({
        name: bookInput.name,
        id: bookInput.id,
        process: 0,
        url: bookInput.filePath,
        format: this.format,
        pdfProgress: { pageIndex: 0, charOffset: 0 }
      }),
      extract: extractPdf,
      toChapterRefs: toPageRefs,
      cache: this.cache,
      failurePrefix: '解析 pdf 失败'
    });
  }

  createReader(input: CreateReaderInput): PdfReader {
    return new PdfReader(input.book, input.services, this.extractionLoader);
  }

  getOutline(book: BookData): Promise<BookOutlineItem[]> {
    return Promise.resolve(createBookOutline(book));
  }

  deleteCache(book: BookData): Promise<void> {
    return this.cache.delete(book.id);
  }
}
