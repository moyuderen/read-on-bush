import * as assert from 'assert';
import { PdfProvider } from '../../formats/pdf/PdfProvider';
import type { BookData } from '../../domain/books';

suite('PdfProvider', () => {
  test('declares the pdf format and extension', () => {
    const provider = new PdfProvider();
    assert.strictEqual(provider.format, 'pdf');
    assert.deepStrictEqual([...provider.supportedExtensions], ['pdf']);
  });

  test('getOutline emits a section target per page', async () => {
    const provider = new PdfProvider();
    const book: BookData = {
      id: 'b1',
      name: 't',
      process: 0,
      url: '/t.pdf',
      format: 'pdf',
      chapters: [{ title: '第 1 页' }, { title: '第 2 页' }]
    };

    const outline = await provider.getOutline(book);
    assert.strictEqual(outline.length, 2);

    const first = outline[0].target;
    assert.strictEqual(first.kind, 'section');
    if (first.kind === 'section') {
      assert.strictEqual(first.sectionIndex, 0);
    }

    const second = outline[1].target;
    assert.strictEqual(second.kind, 'section');
    if (second.kind === 'section') {
      assert.strictEqual(second.sectionIndex, 1);
    }
  });
});
