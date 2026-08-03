import * as assert from 'assert';
import { PdfBook } from '../../core/PdfBook';
import {
  formatResolvedCamouflageScreen,
  resolveBuiltinTemplate
} from '../../core/display/camouflageRender';
import type { BookData, PdfProgress } from '../../domain/books';
import type { ReadBook } from '../../core/ReadBook';
import type { PdfExtraction } from '../../core/parsers/PdfExtractor';

function createApp() {
  const updates: Array<{ id: string; progress: PdfProgress }> = [];
  const app = {
    bookList: {
      updatePdfProgress(id: string, progress: PdfProgress) {
        updates.push({ id, progress });
      }
    }
  } as unknown as ReadBook;
  return { app, updates };
}

const extraction: PdfExtraction = {
  bookTitle: '测试书',
  pages: [
    { title: '第 1 页', text: '一二三四五六七八九十'.repeat(3), images: [{ index: 0, width: 2, height: 2 }] },
    { title: '第 2 页', text: '第二页内容第二页内容', images: [] },
    { title: '第 3 页', text: '末页末页末页末页末页', images: [{ index: 0, width: 10, height: 10 }] }
  ]
};

function createBook(): BookData {
  return { id: 'b1', name: 't', process: 0, url: '/t.pdf', format: 'pdf' };
}

suite('PdfBook paginated reading', () => {
  test('initial progress label is 第 1 页 · 全书 0%', () => {
    const { app } = createApp();
    const pdfBook = new PdfBook(createBook(), app, extraction);
    assert.strictEqual(pdfBook.getProgressLabel(), '  第 1 页 · 全书 0%');
  });

  test('images in view follow the current page range', () => {
    const { app } = createApp();
    const pdfBook = new PdfBook(createBook(), app, extraction);

    const startImages = pdfBook.getImagesInView(10, 3);
    assert.strictEqual(startImages.length, 1);
    assert.strictEqual(startImages[0].pageIndex, 0);

    pdfBook.jumpToPage(2);
    const lastImages = pdfBook.getImagesInView(10, 3);
    assert.strictEqual(lastImages.length, 1);
    assert.strictEqual(lastImages[0].pageIndex, 2);
  });

  test('jumpToPage updates the progress label to the target page', () => {
    const { app } = createApp();
    const pdfBook = new PdfBook(createBook(), app, extraction);
    pdfBook.jumpToPage(2);
    assert.strictEqual(pdfBook.getProgressLabel().includes('第 3 页'), true);
  });

  test('getScreen lines are sanitized of terminal controls', () => {
    const { app } = createApp();
    const dirty: PdfExtraction = {
      bookTitle: 'x',
      pages: [{ title: '第 1 页', text: 'abcd\x1b[2Jefgh', images: [] }]
    };
    const pdfBook = new PdfBook(createBook(), app, dirty);
    const screen = pdfBook.getScreen(4, 2);
    const rendered = formatResolvedCamouflageScreen(
      resolveBuiltinTemplate('buildLog'),
      screen.lines,
      screen.progressLabel
    );
    assert.strictEqual(rendered.slice(4).includes('\x1b[2J'), false);
  });

  test('persists pdfProgress on construction and navigation', () => {
    const { app, updates } = createApp();
    const book = createBook();
    const pdfBook = new PdfBook(book, app, extraction);

    assert.strictEqual(updates.length >= 1, true);
    assert.strictEqual(book.pdfProgress?.pageIndex, 0);

    pdfBook.jumpToPage(2);
    assert.strictEqual(book.pdfProgress?.pageIndex, 2);
  });

  test('excludes next-page images when a screen ends exactly at the page boundary', () => {
    const { app } = createApp();
    const boundary: PdfExtraction = {
      bookTitle: 'x',
      pages: [
        { title: '第 1 页', text: 'abcdefghij'.repeat(3), images: [] },
        {
          title: '第 2 页',
          text: 'next page',
          images: [{ index: 0, width: 2, height: 2 }]
        }
      ]
    };
    const pdfBook = new PdfBook(createBook(), app, boundary);

    assert.deepStrictEqual(pdfBook.getScreen(10, 3).lines, [
      'abcdefghij',
      'abcdefghij',
      'abcdefghij'
    ]);
    assert.deepStrictEqual(pdfBook.getImagesInView(10, 3), []);

    assert.strictEqual(pdfBook.next(10, 3), true);
    assert.deepStrictEqual(
      pdfBook.getImagesInView(10, 3).map((image) => image.pageIndex),
      [1]
    );
  });

  test('keeps an image-only page as a navigable empty screen in both directions', () => {
    const { app } = createApp();
    const withEmptyPage: PdfExtraction = {
      bookTitle: 'x',
      pages: [
        { title: '第 1 页', text: 'abcd', images: [] },
        { title: '第 2 页', text: '', images: [{ index: 0, width: 2, height: 2 }] },
        { title: '第 3 页', text: 'wxyz', images: [] }
      ]
    };
    const pdfBook = new PdfBook(createBook(), app, withEmptyPage);

    assert.strictEqual(pdfBook.next(4, 1), true);
    const emptyScreen = pdfBook.getScreen(4, 1);
    assert.deepStrictEqual(emptyScreen.lines, []);
    assert.strictEqual(emptyScreen.progressLabel.includes('第 2 页'), true);
    assert.deepStrictEqual(
      emptyScreen.images.map((image) => image.pageIndex),
      [1]
    );

    assert.strictEqual(pdfBook.next(4, 1), true);
    assert.deepStrictEqual(pdfBook.getScreen(4, 1).lines, ['wxyz']);

    assert.strictEqual(pdfBook.prev(4, 1), true);
    assert.deepStrictEqual(pdfBook.getScreen(4, 1).lines, []);
    assert.strictEqual(pdfBook.getProgressLabel().includes('第 2 页'), true);
  });

  test('rejects an extraction with no pages', () => {
    const { app } = createApp();
    assert.throws(
      () => new PdfBook(createBook(), app, { bookTitle: 'x', pages: [] }),
      /Invalid pdf: no pages/
    );
  });
});
