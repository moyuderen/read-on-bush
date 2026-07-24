import path from 'path';
import type { BookData } from '../domain/books';
import type { BookFormatProvider } from './types';

function normalizeExtension(extension: string): string {
  const value = extension.trim().toLowerCase();
  return value.startsWith('.') ? value : `.${value}`;
}

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export class BookFormatRegistry {
  private readonly providersByExtension = new Map<string, BookFormatProvider>();

  constructor(providers: BookFormatProvider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  register(provider: BookFormatProvider): void {
    for (const extension of provider.supportedExtensions) {
      this.providersByExtension.set(normalizeExtension(extension), provider);
    }
  }

  getSupportedExtensions(): string[] {
    return [...this.providersByExtension.keys()].map((extension) => extension.slice(1));
  }

  isSupportedBookPath(filePath: string): boolean {
    return this.providersByExtension.has(getExtension(filePath));
  }

  getProviderByPath(filePath: string): BookFormatProvider {
    const extension = getExtension(filePath);
    const provider = this.providersByExtension.get(extension);

    if (!provider) {
      throw new Error(`Unsupported book format: ${extension || 'unknown'}`);
    }

    return provider;
  }

  /**
   * 已入库书籍的 provider 解析，找不到时返回 undefined（不抛错）。
   * 书架树渲染、打开、删除都走这里：单个未知格式的书籍不应让整棵树/整个插件挂掉。
   * 导入时若需要严格报错，用 getProviderByPath。
   */
  getProviderForBook(book: BookData): BookFormatProvider | undefined {
    return this.providersByExtension.get(getExtension(book.url));
  }
}
