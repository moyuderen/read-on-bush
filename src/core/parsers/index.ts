import path from 'path';
import { TxtParser } from './TxtParser';

export interface BookParser {
  readContent(): Promise<string[]>;
}

const parserFactories: Record<string, (filePath: string) => BookParser> = {
  '.txt': (filePath: string) => new TxtParser(filePath)
};

export const supportedBookExtensions = Object.keys(parserFactories).map((extension) => extension.slice(1));

export function createBookParser(filePath: string): BookParser {
  const extension = path.extname(filePath).toLowerCase();
  const parserFactory = parserFactories[extension];

  if (!parserFactory) {
    throw new Error(`Unsupported book format: ${extension || 'unknown'}`);
  }

  return parserFactory(filePath);
}

export { TxtParser } from './TxtParser';
