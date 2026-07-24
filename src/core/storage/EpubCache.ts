import { Uri, workspace } from 'vscode';
import type { EpubExtraction } from '../parsers/EpubExtractor';

const EPUB_EXTRACTION_CACHE_VERSION = 2;

export type EpubCacheRecord = {
  version: number;
  fileMtime: number;
  extraction: EpubExtraction;
};

function sanitizeFileName(bookId: string): string {
  return bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * epub 提取结果缓存。按源文件 mtime 失效：文件未变则复用缓存，避免每次打开都重新解压提取。
 * 缓存放于扩展全局存储目录（globalStorageUri/cache），不污染用户目录、不随工作区切换丢失。
 */
export class EpubCache {
  constructor(private readonly cacheDir: Uri) {}

  static create(globalStorageUri: Uri): EpubCache {
    return new EpubCache(Uri.joinPath(globalStorageUri, 'cache'));
  }

  async get(bookId: string, fileMtime: number): Promise<EpubExtraction | undefined> {
    let bytes: Uint8Array;
    try {
      bytes = await workspace.fs.readFile(this.recordUri(bookId));
    } catch {
      return undefined;
    }

    try {
      const record = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as EpubCacheRecord;
      if (record.version !== EPUB_EXTRACTION_CACHE_VERSION || record.fileMtime !== fileMtime) {
        return undefined;
      }
      return record.extraction;
    } catch {
      return undefined;
    }
  }

  async set(bookId: string, fileMtime: number, extraction: EpubExtraction): Promise<void> {
    await workspace.fs.createDirectory(this.cacheDir);
    const record: EpubCacheRecord = {
      version: EPUB_EXTRACTION_CACHE_VERSION,
      fileMtime,
      extraction
    };
    const json = JSON.stringify(record);
    await workspace.fs.writeFile(this.recordUri(bookId), new TextEncoder().encode(json));
  }

  async delete(bookId: string): Promise<void> {
    try {
      await workspace.fs.delete(this.recordUri(bookId));
    } catch {
      // 缺失即视为已删除
    }
  }

  private recordUri(bookId: string): Uri {
    return Uri.joinPath(this.cacheDir, `${sanitizeFileName(bookId)}.json`);
  }
}
