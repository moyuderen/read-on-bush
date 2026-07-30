import * as assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Uri } from 'vscode';
import { PdfCache } from '../../core/storage/PdfCache';

async function withCacheRecord(record: unknown, run: (cache: PdfCache) => Promise<void>): Promise<void> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'read-on-bush-pdf-cache-'));
  try {
    await fs.promises.writeFile(path.join(directory, 'book.json'), JSON.stringify(record));
    await run(new PdfCache(Uri.file(directory)));
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

suite('PdfCache validation', () => {
  test('rejects a cache record whose extraction has no pages', async () => {
    await withCacheRecord(
      {
        version: 1,
        fileMtime: 123,
        extraction: { bookTitle: 'x', pages: [] }
      },
      async (cache) => {
        assert.strictEqual(await cache.get('book', 123), undefined);
      }
    );
  });

  test('returns a structurally valid extraction', async () => {
    const extraction = {
      bookTitle: 'x',
      pages: [{ title: '第 1 页', text: 'text', images: [{ index: 0, width: 2, height: 2 }] }]
    };
    await withCacheRecord(
      { version: 1, fileMtime: 123, extraction },
      async (cache) => {
        assert.deepStrictEqual(await cache.get('book', 123), extraction);
      }
    );
  });
});
