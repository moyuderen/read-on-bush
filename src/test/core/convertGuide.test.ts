import * as assert from 'assert';
import { CLOUDCONVERT_URL, summarizeConvertible } from '../../core/convertGuide';

suite('convertGuide', () => {
  suite('summarizeConvertible', () => {
    test('按发现顺序返回去重扩展名', () => {
      assert.deepStrictEqual(
        summarizeConvertible(['/shelf/a.mobi', '/shelf/b.mobi', '/shelf/c.pdf', '/shelf/d.azw3']),
        ['mobi', 'pdf', 'azw3']
      );
    });

    test('空数组返回空', () => {
      assert.deepStrictEqual(summarizeConvertible([]), []);
    });

    test('无扩展名路径不计入', () => {
      assert.deepStrictEqual(summarizeConvertible(['/shelf/noext', '/shelf/a.mobi']), ['mobi']);
    });

    test('大小写不敏感', () => {
      assert.deepStrictEqual(summarizeConvertible(['/a.MOBI', '/b.PDF']), ['mobi', 'pdf']);
    });
  });

  test('CLOUDCONVERT_URL 是 https 地址', () => {
    assert.strictEqual(CLOUDCONVERT_URL.startsWith('https://'), true);
  });
});
