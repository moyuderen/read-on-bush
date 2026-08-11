import * as assert from 'assert';
import type { BookData } from '../../domain/books';
import {
  getBookDisplayName,
  getBookMessageName,
  getBookTooltip
} from '../../application/PrivacyService';

const book: BookData = {
  id: 'abc123-book',
  name: '真实书名',
  process: 0,
  url: '/Users/example/books/book.epub',
  format: 'epub',
  privacyAlias: 'Project Notes'
};

describe('PrivacyService', () => {
  it('normal mode uses the real book name and a compact tooltip', () => {
    assert.strictEqual(getBookDisplayName(book, 'normal'), '真实书名');
    assert.strictEqual(getBookMessageName(book, 'normal'), '《真实书名》');
    assert.strictEqual(getBookTooltip(book, 'normal'), '文件：book.epub\n格式：EPUB');
  });

  it('private mode uses the alias and hides the source path', () => {
    assert.strictEqual(getBookDisplayName(book, 'private'), 'Project Notes');
    assert.strictEqual(getBookMessageName(book, 'private'), '文档');
    assert.strictEqual(getBookTooltip(book, 'private'), 'Project Notes');
    assert.strictEqual(getBookTooltip(book, 'private').includes('/Users/example'), false);
    assert.strictEqual(getBookTooltip(book, 'private').includes('真实书名'), false);
  });

  it('private mode falls back to a stable neutral name', () => {
    const withoutAlias = { ...book, privacyAlias: undefined };
    assert.strictEqual(getBookDisplayName(withoutAlias, 'private'), 'Book abc123');
  });
});
