import path from 'path';
import { TxtParser } from './TxtParser';

export interface BookParser {
  readContent(): Promise<string[]>;
}

export type BookParserOptions = {
  lineWidth?: number;
};

const parserFactories: Record<string, (filePath: string, options?: BookParserOptions) => BookParser> = {
  '.txt': (filePath: string, options?: BookParserOptions) => new TxtParser(filePath, options)
};

export const supportedBookExtensions = Object.keys(parserFactories).map((extension) => extension.slice(1));

export function createBookParser(filePath: string, options: BookParserOptions = {}): BookParser {
  const extension = path.extname(filePath).toLowerCase();
  const parserFactory = parserFactories[extension];

  if (!parserFactory) {
    throw new Error(`Unsupported book format: ${extension || 'unknown'}`);
  }

  return parserFactory(filePath, options);
}

export { TxtParser } from './TxtParser';
