import fs from 'fs';
import type { BookData } from '../domain/books';

export interface ExtractionStore<T> {
  get(bookId: string, fileMtime: number): Promise<T | undefined>;
  set(bookId: string, fileMtime: number, extraction: T): Promise<void>;
}

export class CachedExtractionLoader<T> {
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly store: ExtractionStore<T>,
    private readonly extract: (filePath: string) => Promise<T>
  ) {}

  async load(book: BookData): Promise<T> {
    const stat = await fs.promises.stat(book.url);
    const key = `${book.id}:${stat.mtimeMs}`;
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    const extractionPromise = this.loadOrExtract(book, stat.mtimeMs);
    this.pending.set(key, extractionPromise);
    void extractionPromise.then(
      () => this.clearPending(key, extractionPromise),
      () => this.clearPending(key, extractionPromise)
    );
    return extractionPromise;
  }

  private clearPending(key: string, extraction: Promise<T>): void {
    if (this.pending.get(key) === extraction) {
      this.pending.delete(key);
    }
  }

  private async loadOrExtract(book: BookData, fileMtime: number): Promise<T> {
    const cached = await this.store.get(book.id, fileMtime);
    if (cached !== undefined) {
      return cached;
    }

    const extraction = await this.extract(book.url);
    // 缓存写入只服务于下次打开，不应阻塞本次阅读；失败静默（不影响阅读）。
    void this.store.set(book.id, fileMtime, extraction).catch(() => undefined);
    return extraction;
  }
}
