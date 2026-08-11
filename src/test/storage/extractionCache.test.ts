import * as assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Uri } from 'vscode';
import { ExtractionCache } from '../../infrastructure/storage/ExtractionCache';

type Entry = { text: string };

function isEntry(value: unknown): value is Entry {
  return !!value && typeof value === 'object' && typeof (value as Entry).text === 'string';
}

async function withCacheDir(
  run: (dir: string) => Promise<void>
): Promise<void> {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'read-on-bush-extraction-cache-')
  );
  try {
    await run(directory);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

/**
 * 手动写入一个伪缓存记录文件，便于控制文件内容和 mtime。
 */
async function writeCacheFile(
  dir: string,
  bookId: string,
  payload: unknown,
  mtimeMs?: number
): Promise<void> {
  const filePath = path.join(dir, `${encodeURIComponent(bookId)}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(payload));
  if (mtimeMs !== undefined) {
    const ageSeconds = (Date.now() - mtimeMs) / 1000;
    const atime = new Date();
    const mtime = new Date(mtimeMs);
    await fs.promises.utimes(filePath, atime, mtime);
    // workspace.fs.stat 返回的 mtime 可能受精度影响；等待一下确保时间差可区分
    if (ageSeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

suite('ExtractionCache size management', () => {
  test('getCacheSize sums all json files', async () => {
    await withCacheDir(async (dir) => {
      const cache = new ExtractionCache<Entry>(Uri.file(dir), {
        version: 1,
        isExtraction: isEntry
      });

      await cache.set('a', 1, { text: 'hello' });
      await cache.set('b', 1, { text: 'world' });

      const size = await cache.getCacheSize();
      assert.ok(size > 0, 'cache size should be positive');

      // 单个文件大小应小于总和
      const fileA = await fs.promises.stat(path.join(dir, `${encodeURIComponent('a')}.json`));
      assert.ok(size >= fileA.size, 'total size should include file a');
    });
  });

  test('clearAll removes every json file', async () => {
    await withCacheDir(async (dir) => {
      const cache = new ExtractionCache<Entry>(Uri.file(dir), {
        version: 1,
        isExtraction: isEntry
      });

      await cache.set('a', 1, { text: 'hello' });
      await cache.set('b', 1, { text: 'world' });
      assert.ok((await cache.getCacheSize()) > 0);

      await cache.clearAll();

      assert.strictEqual(await cache.getCacheSize(), 0);
      assert.strictEqual(await cache.get('a', 1), undefined);
      assert.strictEqual(await cache.get('b', 1), undefined);
    });
  });

  test('enforceLimit evicts oldest files first', async () => {
    await withCacheDir(async (dir) => {
      // 写入三个不同 mtime 的缓存文件
      await writeCacheFile(
        dir,
        'old',
        { bookId: 'old', version: 1, fileMtime: 1, extraction: { text: 'old data' } },
        Date.now() - 10_000
      );
      await writeCacheFile(
        dir,
        'mid',
        { bookId: 'mid', version: 1, fileMtime: 1, extraction: { text: 'mid data' } },
        Date.now() - 5_000
      );
      await writeCacheFile(
        dir,
        'new',
        { bookId: 'new', version: 1, fileMtime: 1, extraction: { text: 'new data' } },
        Date.now()
      );

      const cache = new ExtractionCache<Entry>(Uri.file(dir), {
        version: 1,
        isExtraction: isEntry
      });

      const totalSize = await cache.getCacheSize();
      assert.ok(totalSize > 0);

      // 将上限设为总大小的一半，应淘汰最旧的文件
      const halfLimit = Math.floor(totalSize / 2);
      await cache.enforceLimit(halfLimit);

      const remainingSize = await cache.getCacheSize();
      assert.ok(
        remainingSize <= halfLimit || remainingSize < totalSize,
        'remaining size should be reduced'
      );

      // 最旧的 'old' 文件应被删除（或至少比 'new' 更可能被删）
      const oldResult = await cache.get('old', 1);
      const newResult = await cache.get('new', 1);
      assert.strictEqual(oldResult, undefined, 'oldest file should be evicted');
      assert.deepStrictEqual(newResult, { text: 'new data' }, 'newest file should survive');
    });
  });

  test('enforceLimit with 0 maxBytes is a no-op', async () => {
    await withCacheDir(async (dir) => {
      const cache = new ExtractionCache<Entry>(Uri.file(dir), {
        version: 1,
        isExtraction: isEntry
      });

      await cache.set('a', 1, { text: 'hello' });
      const sizeBefore = await cache.getCacheSize();

      await cache.enforceLimit(0);

      const sizeAfter = await cache.getCacheSize();
      assert.strictEqual(sizeBefore, sizeAfter);
    });
  });

  test('set triggers auto-eviction when maxSizeBytes is configured', async () => {
    await withCacheDir(async (dir) => {
      // 使用很小的 maxSizeBytes，使得第二个 set 后总大小超限
      const cache = new ExtractionCache<Entry>(Uri.file(dir), {
        version: 1,
        isExtraction: isEntry,
        maxSizeBytes: 1
      });

      await cache.set('a', 1, { text: 'hello' });
      await cache.set('b', 1, { text: 'world' });

      // 等待异步淘汰完成（scheduleEviction 是 fire-and-forget）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 至少一个文件应被淘汰（总大小 > 1 字节时无法全部保留）
      const size = await cache.getCacheSize();
      assert.ok(
        size <= 1 || (await cache.get('a', 1)) === undefined || (await cache.get('b', 1)) === undefined,
        'auto-eviction should have removed at least one file'
      );
    });
  });

  test('getCacheSize returns 0 for non-existent directory', async () => {
    await withCacheDir(async (dir) => {
      const nonExistent = path.join(dir, 'does-not-exist');
      const cache = new ExtractionCache<Entry>(Uri.file(nonExistent), {
        version: 1,
        isExtraction: isEntry
      });

      assert.strictEqual(await cache.getCacheSize(), 0);
    });
  });
});
