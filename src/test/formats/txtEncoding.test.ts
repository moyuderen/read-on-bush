import * as assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { workspace, ConfigurationTarget } from 'vscode';
import type { BookData } from '../../domain/books';
import { createConfiguredTxtParser } from '../../formats/txt/createTxtParser';
import { TxtProvider } from '../../formats/txt/TxtProvider';
import { TxtReadingController } from '../../formats/txt/TxtReadingController';
import type { ReaderServices } from '../../formats/BookFormat';
import { GlobalStateBookStore } from '../../infrastructure/storage/BookStore';

suite('Per-book TXT encoding', () => {
  test('reading and search honor each book while explicit auto overrides the global setting', async () => {
    const config = workspace.getConfiguration('readOnBush');
    const original = config.inspect('txtEncoding')?.globalValue;
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reader-encoding-'));
    const utf: BookData = { id: 'utf', name: 'UTF', url: path.join(directory, 'utf.txt'), process: 0, txtEncoding: 'utf-8' };
    const gb: BookData = { id: 'gb', name: 'GB', url: path.join(directory, 'gb.txt'), process: 0, txtEncoding: 'gb18030' };
    const text = '中文测试';
    const errors: string[] = [];
    const services = {
      txtDisplay: { render() {}, pause() {}, getNextProcessStep: () => 1, getPrevProcessStep: () => 1 },
      bookCatalog: { updateBookProcess() {} },
      notifier: { info() {}, warn() {}, error: (value: string) => errors.push(value) },
      privacyDisplay: { getBookMessageName: (book: BookData) => book.name }
    } as unknown as ReaderServices;
    try {
      await fs.promises.writeFile(utf.url, '\ufeff' + text, 'utf8');
      await fs.promises.writeFile(gb.url, Buffer.from('d6d0cec4b2e2cad4', 'hex'));
      await config.update('txtEncoding', 'utf-16le', ConfigurationTarget.Global);
      for (const book of [gb, utf, gb]) {
        const reader = new TxtReadingController(book, services);
        try {
          assert.strictEqual(await reader.open(), true);
          assert.strictEqual(reader.currentTxtState?.content, text);
          const search = await new TxtProvider().loadSearchDocument(book);
          assert.ok(JSON.stringify(search).includes(text));
        } finally {
          await reader.close();
        }
      }
      const automatic = { ...utf, txtEncoding: 'auto' as const };
      assert.deepStrictEqual(await createConfiguredTxtParser(automatic).readContent(), [text]);
      await config.update('txtEncoding', 'gb18030', ConfigurationTarget.Global);
      assert.deepStrictEqual(await createConfiguredTxtParser({ ...gb, txtEncoding: undefined }).readContent(), [text]);
      assert.deepStrictEqual(await createConfiguredTxtParser({ ...gb, txtEncoding: 'invalid' as any }).readContent(), [text]);
      assert.deepStrictEqual(errors, []);
    } finally {
      await config.update('txtEncoding', original, ConfigurationTarget.Global);
      await fs.promises.rm(directory, { recursive: true, force: true });
    }
  });

  test('persists overrides per book and clears them without changing progress or other books', async () => {
    const memory: Record<string, unknown> = { books: [
      { id: 'one', name: 'one', url: 'one.txt', process: 12 },
      { id: 'two', name: 'two', url: 'two.txt', process: 34, txtEncoding: 'utf-8' },
      { id: 'old', name: 'old', url: 'old.txt', process: 1, txtEncoding: 'invalid' }
    ] };
    const storage = {
      getStorage: <T = unknown>(key: string) => structuredClone(memory[key]) as T,
      setStorage: async <T>(key: string, value: T) => { memory[key] = structuredClone(value); }
    };
    const store = new GlobalStateBookStore(storage);
    assert.strictEqual(store.getBooks()[0].txtEncoding, undefined);
    assert.strictEqual(store.getBooks()[2].txtEncoding, undefined);
    store.updateBookTxtEncoding('one', 'gb18030');
    await store.flush();
    const restarted = new GlobalStateBookStore(storage);
    assert.strictEqual(restarted.getBooks()[0].txtEncoding, 'gb18030');
    assert.strictEqual(restarted.getBooks()[0].process, 12);
    assert.strictEqual(restarted.getBooks()[1].txtEncoding, 'utf-8');
    restarted.updateBookTxtEncoding('one', 'auto');
    await restarted.flush();
    assert.strictEqual(new GlobalStateBookStore(storage).getBooks()[0].txtEncoding, 'auto');
    restarted.updateBookTxtEncoding('one', undefined);
    await restarted.flush();
    assert.strictEqual(new GlobalStateBookStore(storage).getBooks()[0].txtEncoding, undefined);
    assert.strictEqual(new GlobalStateBookStore(storage).getBooks()[1].process, 34);
  });
});
