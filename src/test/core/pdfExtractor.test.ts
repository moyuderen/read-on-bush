import * as assert from 'assert';
import { toPageRefs } from '../../core/parsers/PdfExtractor';
import type { PdfExtraction } from '../../core/parsers/PdfExtractor';

suite('PdfExtractor toPageRefs', () => {
  test('maps pages to chapter refs preserving order and titles', () => {
    const extraction: PdfExtraction = {
      bookTitle: 'x',
      pages: [
        { title: '第 1 页', text: 'a', images: [] },
        { title: '第 2 页', text: 'b', images: [{ index: 0, width: 2, height: 2 }] }
      ]
    };

    assert.deepStrictEqual(toPageRefs(extraction), [{ title: '第 1 页' }, { title: '第 2 页' }]);
  });
});
