import { Uri } from 'vscode';
import { BookFormatRegistry } from './BookFormatRegistry';
import { EpubProvider } from './epub/EpubProvider';
import { PdfProvider } from './pdf/PdfProvider';
import { TxtProvider } from './txt/TxtProvider';
import { getCacheLimitMB } from '../config/settings';

export function createDefaultBookFormatRegistry(
  cacheDirectory: Uri = Uri.file(process.cwd())
): BookFormatRegistry {
  // mobi/azw3 是 Amazon 专有二进制——不自研解析，改为引导用户去 CloudConvert 转 epub。
  // pdf 由 PdfProvider 原生支持（pdfjs 抽取文本 + 图片）。
  const maxCacheBytes = getCacheLimitMB() * 1024 * 1024;
  return new BookFormatRegistry(
    [
      new TxtProvider(),
      new EpubProvider(cacheDirectory, maxCacheBytes),
      new PdfProvider(cacheDirectory, maxCacheBytes)
    ],
    ['mobi', 'azw3']
  );
}

export type {
  BookFormatProvider,
  BookReaderController,
  ReaderJumpOptions,
  ReaderServices,
  TxtReaderCapability
} from './BookFormat';
export { BookFormatRegistry } from './BookFormatRegistry';
