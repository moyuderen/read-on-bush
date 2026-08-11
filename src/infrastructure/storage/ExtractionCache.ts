import { FileType, Uri, workspace } from 'vscode';

export type ExtractionCacheRecord<T> = {
  bookId: string;
  version: number;
  fileMtime: number;
  lastAccessAt?: number;
  extraction: T;
};

export type ExtractionCacheOptions<T> = {
  version: number;
  isExtraction: (value: unknown) => value is T;
  /** 缓存上限（字节）；超过后自动淘汰最旧文件。0 / undefined = 不限制。 */
  maxSizeBytes?: number;
};

const pendingDirectoryOperations = new Map<string, Promise<void>>();

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
  const cleanup = () => {
    if (map.get(key) === current) {
      map.delete(key);
    }
  };
  void current.then(cleanup, cleanup);
  return current;
}

export class ExtractionCache<T> {
  private maxSizeBytes: number;

  constructor(
    private readonly cacheDir: Uri,
    private readonly options: ExtractionCacheOptions<T>
  ) {
    this.maxSizeBytes = options.maxSizeBytes ?? 0;
  }

  async setMaxSizeBytes(maxSizeBytes: number): Promise<void> {
    this.maxSizeBytes = Number.isFinite(maxSizeBytes) ? Math.max(0, Math.floor(maxSizeBytes)) : 0;
    await this.enqueueDirectory(() => this.enforceLimitInternal(this.maxSizeBytes));
  }

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
      void this.touchAccessTime(bookId);
      return value.extraction;
    } catch {
      return undefined;
    }
  }

  async set(bookId: string, fileMtime: number, extraction: T): Promise<void> {
    await this.enqueueDirectory(async () => {
      await workspace.fs.createDirectory(this.cacheDir);
      const record: ExtractionCacheRecord<T> = {
        bookId,
        version: this.options.version,
        fileMtime,
        lastAccessAt: Date.now(),
        extraction
      };
      await workspace.fs.writeFile(
        this.recordUri(bookId),
        new TextEncoder().encode(JSON.stringify(record))
      );
      await this.enforceLimitInternal(this.maxSizeBytes);
    });
  }

  async delete(bookId: string): Promise<void> {
    await this.enqueueDirectory(async () => {
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
    await this.enqueueDirectory(async () => {
      const names = await this.listCacheFileNames();
      await Promise.all(names.map((name) => this.deleteCacheFile(name)));
    });
  }

  /** 按最后访问时间淘汰缓存；旧记录回退到文件 mtime。 */
  async enforceLimit(maxBytes: number): Promise<void> {
    await this.enqueueDirectory(() => this.enforceLimitInternal(maxBytes));
  }

  private async enforceLimitInternal(maxBytes: number): Promise<void> {
    if (maxBytes <= 0) {
      return;
    }

    const entries = (await this.listCacheEntries()).sort((a, b) => a.lastAccessAt - b.lastAccessAt);
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

  /**
   * 扫描缓存目录，返回文件大小和最后访问时间。
   * 旧缓存没有 lastAccessAt 时回退到文件 mtime。
   */
  private async listCacheEntries(): Promise<
    Array<{ name: string; size: number; lastAccessAt: number }>
  > {
    const names = await this.listCacheFileNames();
    const stats = await Promise.all(
      names.map(async (name) => {
        try {
          const uri = Uri.joinPath(this.cacheDir, name);
          const stat = await workspace.fs.stat(uri);
          let lastAccessAt = stat.mtime;
          try {
            const value = JSON.parse(new TextDecoder('utf-8').decode(await workspace.fs.readFile(uri))) as {
              lastAccessAt?: unknown;
            };
            if (typeof value.lastAccessAt === 'number') {
              lastAccessAt = value.lastAccessAt;
            }
          } catch {
            // 读取元数据失败时使用文件 mtime。
          }
          return { name, size: stat.size, lastAccessAt };
        } catch {
          return undefined;
        }
      })
    );
    return stats.filter((entry): entry is { name: string; size: number; lastAccessAt: number } =>
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

  private async touchAccessTime(bookId: string): Promise<void> {
    await this.enqueueDirectory(async () => {
      const uri = this.recordUri(bookId);
      try {
        const record = JSON.parse(new TextDecoder('utf-8').decode(await workspace.fs.readFile(uri))) as Record<string, unknown>;
        record.lastAccessAt = Date.now();
        await workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(record)));
      } catch {
        // 缓存可能已在触碰期间被清理，忽略即可。
      }
    });
  }

  private enqueueDirectory(operation: () => Promise<void>): Promise<void> {
    return serialize(pendingDirectoryOperations, this.cacheDir.toString(), operation);
  }

  private recordUri(bookId: string): Uri {
    return Uri.joinPath(this.cacheDir, `${encodeURIComponent(bookId)}.json`);
  }
}

