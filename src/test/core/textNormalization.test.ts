import * as assert from 'assert';
import { normalizeCjkSpacing, normalizeCjkSpacingWithOffsetMap } from '../../core/textNormalization';

suite('textNormalization', () => {
  test('removes PDF layout spaces between CJK characters and punctuation', () => {
    assert.strictEqual(
      normalizeCjkSpacing('比 如 电 商 、 旅 游 特 产 捆 绑 ， 还 有 “ 时 势 造 英 雄 ” 。'),
      '比如电商、旅游特产捆绑，还有“时势造英雄”。'
    );
  });

  test('preserves English word spaces and CJK to Latin spaces', () => {
    assert.strictEqual(
      normalizeCjkSpacing('Use AI model and 使用 AI 模型'),
      'Use AI model and 使用 AI 模型'
    );
  });

  test('maps offsets after removed CJK spacing for image anchors', () => {
    const normalized = normalizeCjkSpacingWithOffsetMap('比 如 图 片');

    assert.strictEqual(normalized.text, '比如图片');
    assert.strictEqual(normalized.mapOffset('比 如 '.length), '比如'.length);
  });
});
