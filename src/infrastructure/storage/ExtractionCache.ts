import { FileType, Uri, workspace } from 'vscode';

export type ExtractionCacheRecord<T> = {
  bookId: string;
  version: number;
  fileMtime: number;
  extraction: T;
};

export type ExtractionCacheOptions<T> = {
  version: number;
  isExtraction: (value: unknown) => value is T;
  /** 缓存上限（字节）；超过后自动淘汰最旧文件。0 / undefined = 不限制。 */
  maxSizeBytes?: number;
};

const pendingOperations = new Map<string, Promise<void>>();
// 逐目录串行化淘汰，避免多次 set 并发触发时重复扫描/删除。
const pendingEvictions = new Map<string, Promise<void>>();

/**
 * 将 task 串行化到 map 中 key 对应的 promise 链上：
 * 同一 key 的任务依次执行，前一个失败不影响后一个。
 * 返回的 promise settle 后自动从 map 中清理。
 */
function serialize(
  map: Map<string, Promise<void>>,
  key: string,
  task: () => Promise<void>
): Promise<void> {
  const previous = map.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  map.set(key, current);
  current.finally(() => {
    if (map.get(key) === current) {
      map.delete(key);
    }
  });
  return current;
}

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
    this.scheduleEviction();
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

  /** 缓存目录中所有 `.json` 文件的总字节数。 */
  async getCacheSize(): Promise<number> {
    const entries = await this.listCacheEntries();
    return entries.reduce((sum, entry) => sum + entry.size, 0);
  }

  /** 删除缓存目录中的所有 `.json` 文件。 */
  async clearAll(): Promise<void> {
    const names = await this.listCacheFileNames();
    await Promise.all(names.map((name) => this.deleteCacheFile(name)));
  }

  /**
   * 容量淘汰：按文件 mtime（写入时间）升序删除，直到总大小 ≤ maxBytes。
   * 这是最少最近写入优先（least-recently-written），非严格 LRU——
   * get（读取）不更新 mtime，因此频繁阅读但未重新解析的书籍仍可能被淘汰。
   */
  async enforceLimit(maxBytes: number): Promise<void> {
    if (maxBytes <= 0) {
      return;
    }

    const entries = (await this.listCacheEntries()).sort((a, b) => a.mtime - b.mtime);
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (totalSize <= maxBytes) {
      return;
    }

    // 从最旧开始收集待删文件，直到总量降到上限以下。
    const victims: string[] = [];
    let remaining = totalSize;
    for (const entry of entries) {
      if (remaining <= maxBytes) {
        break;
      }
      victims.push(entry.name);
      remaining -= entry.size;
    }

    await Promise.all(victims.map((name) => this.deleteCacheFile(name)));
  }

  private scheduleEviction(): void {
    const maxBytes = this.options.maxSizeBytes;
    if (!maxBytes || maxBytes <= 0) {
      return;
    }
    void serialize(pendingEvictions, this.cacheDir.toString(), () =>
      this.enforceLimit(maxBytes)
    );
  }

  /**
   * 扫描缓存目录，返回 `.json` 文件的名称、大小和 mtime。
   * stat 调用并行执行。目录不存在或读取失败时返回空数组（不抛错）。
   */
  private async listCacheEntries(): Promise<
    Array<{ name: string; size: number; mtime: number }>
  > {
    const names = await this.listCacheFileNames();
    const stats = await Promise.all(
      names.map(async (name) => {
        try {
          const stat = await workspace.fs.stat(Uri.joinPath(this.cacheDir, name));
          return { name, size: stat.size, mtime: stat.mtime };
        } catch {
          return undefined;
        }
      })
    );
    return stats.filter((entry): entry is { name: string; size: number; mtime: number } =>
      entry !== undefined
    );
  }

  /** 仅列出缓存目录中的 `.json` 文件名（不做 stat）。 */
  private async listCacheFileNames(): Promise<string[]> {
    let entries: [string, FileType][];
    try {
      entries = await workspace.fs.readDirectory(this.cacheDir);
    } catch {
      return [];
    }
    return entries
      .filter(([name, type]) => type === FileType.File && name.endsWith('.json'))
      .map(([name]) => name);
  }

  /** 删除单个缓存文件，失败静默（缺失即视为已删除）。 */
  private async deleteCacheFile(name: string): Promise<void> {
    try {
      await workspace.fs.delete(Uri.joinPath(this.cacheDir, name));
    } catch {
      // 缺失即视为已删除
    }
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

  private enqueue(bookId: string, operation: () => Promise<void>): Promise<void> {
    return serialize(pendingOperations, `${this.cacheDir.toString()}::${bookId}`, operation);
  }

  private recordUri(bookId: string): Uri {
    return Uri.joinPath(this.cacheDir, `${encodeURIComponent(bookId)}.json`);
  }
}

