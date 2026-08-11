import { Uri } from 'vscode';
import { BookFormatRegistry } from './BookFormatRegistry';
import { EpubProvider } from './epub/EpubProvider';
import { PdfProvider } from './pdf/PdfProvider';
import { TxtProvider } from './txt/TxtProvider';

export function createDefaultBookFormatRegistry(
  cacheDirectory: Uri = Uri.file(process.cwd())
): BookFormatRegistry {
  // mobi/azw3 是 Amazon 专有二进制——不自研解析，改为引导用户去 CloudConvert 转 epub。
  // pdf 由 PdfProvider 原生支持（pdfjs 抽取文本 + 图片）。
  return new BookFormatRegistry(
    [new TxtProvider(), new EpubProvider(cacheDirectory), new PdfProvider(cacheDirectory)],
    ['mobi', 'azw3']
  );
}

export type {
  BookFormatProvider,
  BookReaderController,
  ReaderServices,
  TxtReaderCapability
} from './BookFormat';
export { BookFormatRegistry } from './BookFormatRegistry';
