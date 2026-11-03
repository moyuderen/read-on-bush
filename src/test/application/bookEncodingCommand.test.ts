import * as assert from 'assert';
import { window } from 'vscode';
import { BookCatalog } from '../../application/BookCatalog';
import type { BookData } from '../../domain/books';

suite('Book encoding command', () => {
  async function run(encoding: string | undefined, cancel = false, active = true) {
    const events: string[] = [];
    let books: BookData[] = [{ id: 'one', name: 'one', url: 'one.txt', process: 12, txtEncoding: 'utf-8' }];
    const catalog = Object.create(BookCatalog.prototype) as any;
    const original = window.showQuickPick;
    catalog.books = books;
    catalog.bookStorage = {
      getBooks: () => books,
      updateBookTxtEncoding: (id: string, selected: BookData['txtEncoding']) => {
        events.push('save');
        books = books.map(book => book.id === id ? { ...book, txtEncoding: selected } : book);
        return books;
      },
      flush: async () => { events.push('flush'); }
    };
    catalog.app = {
      formatRegistry: { getProviderForBook: () => ({ format: 'txt' }) },
      readingSession: {
        current: active ? { book: books[0] } : undefined,
        closeCurrent: async () => { events.push('close'); books[0].process = 15; },
        open: async (book: BookData) => { events.push('open'); assert.strictEqual(book.process, 15); }
      },
      searchService: { clear: (id: string) => { assert.strictEqual(id, 'one'); events.push('clearSearch'); } }
    };
    catalog.updateBookTreeProvider = () => { events.push('refresh'); };
    try {
      (window as any).showQuickPick = async () => cancel ? undefined : { encoding };
      await catalog.setTxtEncoding({ type: 'book', bookId: 'one' });
      return { events, books };
    } finally {
      (window as any).showQuickPick = original;
    }
  }

  test('closes first to flush progress, persists, invalidates search and reopens', async () => {
    const result = await run('gb18030');
    assert.deepStrictEqual(result.events, ['close', 'save', 'flush', 'clearSearch', 'refresh', 'open']);
    assert.strictEqual(result.books[0].txtEncoding, 'gb18030');
  });

  test('can clear the override for an inactive book without switching readers', async () => {
    const result = await run(undefined, false, false);
    assert.deepStrictEqual(result.events, ['save', 'flush', 'clearSearch', 'refresh']);
    assert.strictEqual(result.books[0].txtEncoding, undefined);
  });

  test('canceling or reselecting the current encoding has no side effects', async () => {
    assert.deepStrictEqual((await run('gb18030', true)).events, []);
    assert.deepStrictEqual((await run('utf-8')).events, []);
  });
});
