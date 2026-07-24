import path from 'path';
import { TxtParser } from './TxtParser';

export interface BookParser {
  readContent(): Promise<string[]>;
}

export type BookParserOptions = {
  lineWidth?: number;
};

// txt 走 BookParser 工厂；epub/pdf/mobi/azw3 等结构化格式由各自的
// BookFormatProvider 处理（见 src/formats），不进入 parserFactories。
const parserFactories: Record<string, (filePath: string, options?: BookParserOptions) => BookParser> = {
  '.txt': (filePath: string, options?: BookParserOptions) => new TxtParser(filePath, options)
};

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function createBookParser(filePath: string, options: BookParserOptions = {}): BookParser {
  const extension = getExtension(filePath);
  const parserFactory = parserFactories[extension];

  if (!parserFactory) {
    throw new Error(`Unsupported book format: ${extension || 'unknown'}`);
  }

  return parserFactory(filePath, options);
}

export { TxtParser } from './TxtParser';
