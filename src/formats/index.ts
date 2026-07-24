import { BookFormatRegistry } from './registry';
import { EpubProvider } from './epub/EpubProvider';
import { TxtProvider } from './txt/TxtProvider';

export function createDefaultBookFormatRegistry(): BookFormatRegistry {
  return new BookFormatRegistry([new TxtProvider(), new EpubProvider()]);
}

export type { BookFormatProvider, BookReaderController } from './types';
export { BookFormatRegistry } from './registry';
