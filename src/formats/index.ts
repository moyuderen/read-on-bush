import { BookFormatRegistry } from './registry';
import { EpubProvider } from './epub/EpubProvider';
import { TxtProvider } from './txt/TxtProvider';

export function createDefaultBookFormatRegistry(): BookFormatRegistry {
  // mobi/azw3 是 Amazon 专有二进制、pdf 是定版式——不自研解析，改为引导用户去 CloudConvert 转 epub。
  return new BookFormatRegistry([new TxtProvider(), new EpubProvider()], ['mobi', 'azw3', 'pdf']);
}

export type { BookFormatProvider, BookReaderController } from './types';
export { BookFormatRegistry } from './registry';
