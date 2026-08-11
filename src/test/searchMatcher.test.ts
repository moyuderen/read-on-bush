import * as assert from 'assert';
import { searchDocument } from '../domain/search';
import type { SearchDocument } from '../domain/search';

describe('SearchMatcher', () => {
  const document: SearchDocument = {
    bookId: 'book-1',
    format: 'epub',
    segments: [
      {
        index: 0,
        title: '第一章',
        text: '他推开了',
        target: { kind: 'section', sectionIndex: 0, offset: 0 }
      },
      {
        index: 1,
        title: '第二章',
        text: '那扇门。',
        target: { kind: 'section', sectionIndex: 1, offset: 0 }
      }
    ]
  };

  it('matches text across segments and maps to the first segment', () => {
    const page = searchDocument(document, '推开了那扇门', 100);

    assert.strictEqual(page.matches.length, 1);
    assert.deepStrictEqual(page.matches[0].target, {
      kind: 'section',
      sectionIndex: 0,
      offset: 1
    });
    assert.strictEqual(page.hasMore, false);
  });

  it('normalizes full-width characters and whitespace', () => {
    const normalizedDocument: SearchDocument = {
      ...document,
      segments: [{
        index: 0,
        text: 'ＡＢＣ  世界',
        target: { kind: 'section', sectionIndex: 0, offset: 0 }
      }]
    };

    assert.strictEqual(searchDocument(normalizedDocument, 'ABC 世界', 100).matches.length, 1);
  });

  it('limits the first page and resumes from the next offset', () => {
    const repeated: SearchDocument = {
      ...document,
      segments: [{
        index: 0,
        text: 'a a a a',
        target: { kind: 'section', sectionIndex: 0, offset: 0 }
      }]
    };

    const first = searchDocument(repeated, 'a', 2);
    const second = searchDocument(repeated, 'a', 2, first.nextOffset);

    assert.strictEqual(first.matches.length, 2);
    assert.strictEqual(first.hasMore, true);
    assert.strictEqual(second.matches.length, 2);
    assert.strictEqual(second.hasMore, false);
  });
});
