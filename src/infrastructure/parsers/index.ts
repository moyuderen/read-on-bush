import { TxtParser } from './TxtParser';
import { getFileExtension } from '../../utils/fileExtension';

export interface BookParser {
  readContent(): Promise<string[]>;
}

export type TxtEncoding = 'auto' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030';

export type BookParserOptions = {
  lineWidth?: number;
  encoding?: TxtEncoding;
};

// txt 走 BookParser 工厂；epub/pdf/mobi/azw3 等结构化格式由各自的
// BookFormatProvider 处理（见 src/formats），不进入 parserFactories。
const parserFactories: Record<string, (filePath: string, options?: BookParserOptions) => BookParser> = {
  '.txt': (filePath: string, options?: BookParserOptions) => new TxtParser(filePath, options)
};

export function createBookParser(filePath: string, options: BookParserOptions = {}): BookParser {
  const extension = getFileExtension(filePath);
  const parserFactory = parserFactories[extension];

  if (!parserFactory) {
    throw new Error(`Unsupported book format: ${extension || 'unknown'}`);
  }

  return parserFactory(filePath, options);
}

export { TxtParser } from './TxtParser';
