import { Uri, workspace } from 'vscode';

export type ExtractionCacheRecord<T> = {
  bookId: string;
  version: number;
  fileMtime: number;
  extraction: T;
};

export type ExtractionCacheOptions<T> = {
  version: number;
  isExtraction: (value: unknown) => value is T;
};

const pendingOperations = new Map<string, Promise<void>>();

export class ExtractionCache<T> {
  constructor(
    private readonly cacheDir: Uri,
    private readonly options: ExtractionCacheOptions<T>
  ) {}

  async get(bookId: string, fileMtime: number): Promise<T | undefined> {
    let bytes: Uint8Array;
    try {
      bytes = await workspace.fs.readFile(this.recordUri(bookId));
    } catch {
      return undefined;
    }

    try {
      const value = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as unknown;
      if (!this.isValidRecord(value, bookId, fileMtime)) {
        return undefined;
      }
      return value.extraction;
    } catch {
      return undefined;
    }
  }

  async set(bookId: string, fileMtime: number, extraction: T): Promise<void> {
    await this.enqueue(bookId, async () => {
      await workspace.fs.createDirectory(this.cacheDir);
      const record: ExtractionCacheRecord<T> = {
        bookId,
        version: this.options.version,
        fileMtime,
        extraction
      };
      await workspace.fs.writeFile(
        this.recordUri(bookId),
        new TextEncoder().encode(JSON.stringify(record))
      );
    });
  }

  async delete(bookId: string): Promise<void> {
    await this.enqueue(bookId, async () => {
      try {
        await workspace.fs.delete(this.recordUri(bookId));
      } catch {
        // 缺失即视为已删除
      }
    });
  }

  private isValidRecord(
    value: unknown,
    bookId: string,
    fileMtime: number
  ): value is ExtractionCacheRecord<T> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as Partial<ExtractionCacheRecord<unknown>>;
    return (
      record.bookId === bookId &&
      record.version === this.options.version &&
      record.fileMtime === fileMtime &&
      this.options.isExtraction(record.extraction)
    );
  }

  private async enqueue(bookId: string, operation: () => Promise<void>): Promise<void> {
    const key = `${this.cacheDir.toString()}::${bookId}`;
    const previous = pendingOperations.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    pendingOperations.set(key, current);

    try {
      await current;
    } finally {
      if (pendingOperations.get(key) === current) {
        pendingOperations.delete(key);
      }
    }
  }

  private recordUri(bookId: string): Uri {
    return Uri.joinPath(this.cacheDir, `${encodeURIComponent(bookId)}.json`);
  }
}

