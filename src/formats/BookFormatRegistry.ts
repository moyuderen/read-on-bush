import type { BookData } from '../domain/books';
import { getFileExtension } from '../utils/fileExtension';
import type { BookFormatProvider } from './BookFormat';

function normalizeExtension(extension: string): string {
  const value = extension.trim().toLowerCase();
  return value.startsWith('.') ? value : `.${value}`;
}

export type PathKind = 'supported' | 'convertible' | 'unknown';

export class BookFormatRegistry {
  private readonly providersByExtension = new Map<string, BookFormatProvider>();
  // 可识别但非原生支持、需引导用户外部转换的扩展名（如 mobi/azw3/pdf）。
  private readonly convertibleExtensions = new Set<string>();

  constructor(providers: BookFormatProvider[] = [], convertibleExtensions: readonly string[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
    for (const extension of convertibleExtensions) {
      this.convertibleExtensions.add(normalizeExtension(extension));
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
    return this.providersByExtension.has(getFileExtension(filePath));
  }

  getProviderByPath(filePath: string): BookFormatProvider {
    const extension = getFileExtension(filePath);
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
    return this.providersByExtension.get(getFileExtension(book.url));
  }

  /**
   * 路径分类：原生支持 / 需引导转换 / 未知。集中「app 响应哪些扩展名」的判断，
   * 避免调用方各自硬编码 if/else；新增 convertible 格式只需构造时注册。
   */
  classifyPath(filePath: string): PathKind {
    const extension = getFileExtension(filePath);
    if (this.providersByExtension.has(extension)) {
      return 'supported';
    }
    return this.convertibleExtensions.has(extension) ? 'convertible' : 'unknown';
  }

  /** app 会响应的所有扩展名：原生支持 ∪ 需转换。供导入对话框 filter。 */
  getAcknowledgedExtensions(): string[] {
    return [...this.providersByExtension.keys(), ...this.convertibleExtensions].map((extension) =>
      extension.slice(1)
    );
  }

  /**
   * 清除缓存。EPUB/PDF 共享同一缓存目录，清除任一 provider 即清空全部。
   */
  async clearAllCaches(): Promise<void> {
    for (const provider of new Set(this.providersByExtension.values())) {
      if (provider.clearCache) {
        await provider.clearCache();
        return;
      }
    }
  }

  /**
   * 所有 provider 缓存当前占用的总字节数。
   * EPUB/PDF 共享同一目录，仅查询首个支持的 provider 以避免重复计算。
   */
  async getTotalCacheSize(): Promise<number> {
    for (const provider of new Set(this.providersByExtension.values())) {
      if (provider.getCacheSize) {
        return provider.getCacheSize();
      }
    }
    return 0;
  }

  /** 动态更新共享解析缓存上限；所有共享 provider 同步更新限制。 */
  async updateCacheLimitBytes(maxSizeBytes: number): Promise<void> {
    const updates = [...new Set(this.providersByExtension.values())]
      .filter((provider) => provider.setCacheLimitBytes)
      .map((provider) => provider.setCacheLimitBytes!(maxSizeBytes));
    await Promise.all(updates);
  }
}
