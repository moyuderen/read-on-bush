import * as assert from 'assert';
import { formatCamouflageScreen } from '../../core/display/camouflageRender';
import { buildProgressLabel, wrapChapter } from '../../core/epubPagination';
import type { EpubExtraction } from '../../core/parsers/EpubExtractor';

suite('epubPagination terminal safety', () => {
  test('wrapChapter strips terminal controls before measuring lines', () => {
    const wrapped = wrapChapter(`abcd\x1b[2Jefgh\x1b]8;;https://example.com\x07link\x1b]8;;\x07ij`, 4);

    assert.deepStrictEqual(wrapped.lines, ['abcd', 'efgh', 'link', 'ij']);
    assert.strictEqual(wrapped.lines.join('').includes('\x1b'), false);
  });

  test('progress labels from chapter titles are sanitized by the terminal renderer', () => {
    const extraction: EpubExtraction = {
      bookTitle: 'book',
      chapters: [{ title: '第 1 章\x1b[2J', text: 'content', images: [] }]
    };

    const label = buildProgressLabel(extraction, { chapterIndex: 0, charOffset: 0 }, [0], 10);
    const screen = formatCamouflageScreen('buildLog', ['content'], label);

    assert.strictEqual(screen.includes('\x1b[2J'), true); // clearScreen prefix remains intentional
    assert.strictEqual(screen.slice(4).includes('\x1b[2J'), false);
    assert.strictEqual(screen.includes('第 1 章 · 全书 0%'), true);
  });
});
