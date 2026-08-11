import * as assert from 'assert';
import {
  countVisibleCharacters,
  getAutoTurnDelayMs,
  defaultAutoTurnConfig,
  type AutoTurnConfig
} from '../../domain/autoTurn/AutoTurnStrategy';

suite('AutoTurnStrategy', () => {
  suite('countVisibleCharacters', () => {
    test('counts plain text characters', () => {
      assert.strictEqual(countVisibleCharacters('hello world'), 10);
    });

    test('counts Chinese characters', () => {
      assert.strictEqual(countVisibleCharacters('你好世界'), 4);
    });

    test('strips ANSI escape codes', () => {
      assert.strictEqual(countVisibleCharacters('\x1b[31m红色\x1b[0m文字'), 4);
    });

    test('strips control characters', () => {
      assert.strictEqual(countVisibleCharacters('a\x00b\x07c\x1Bd'), 4);
    });

    test('ignores all whitespace', () => {
      assert.strictEqual(countVisibleCharacters('  hello  \n\t world  '), 10);
    });

    test('handles empty string', () => {
      assert.strictEqual(countVisibleCharacters(''), 0);
    });

    test('handles whitespace-only string', () => {
      assert.strictEqual(countVisibleCharacters('   \n\t  '), 0);
    });

    test('handles mixed Chinese and English', () => {
      assert.strictEqual(countVisibleCharacters('Hello 你好 World 世界'), 14);
    });
  });

  suite('getAutoTurnDelayMs', () => {
    const config: AutoTurnConfig = { ...defaultAutoTurnConfig };

    test('computes delay from chars and speed', () => {
      // 450 chars at 450 chars/min = 1 min = 60s → clamped to max 30s
      const ms = getAutoTurnDelayMs(450, config);
      assert.strictEqual(ms, 30000);
    });

    test('clamps to minimum', () => {
      // 1 char at 450 chars/min ≈ 0.13s → clamped to min 2s
      const ms = getAutoTurnDelayMs(1, config);
      assert.strictEqual(ms, 2000);
    });

    test('clamps to maximum', () => {
      // 10000 chars at 450 chars/min ≈ 1333s → clamped to max 30s
      const ms = getAutoTurnDelayMs(10000, config);
      assert.strictEqual(ms, 30000);
    });

    test('returns min when chars is zero', () => {
      const ms = getAutoTurnDelayMs(0, config);
      assert.strictEqual(ms, 2000);
    });

    test('fixed seconds overrides char-based calculation', () => {
      const fixedConfig: AutoTurnConfig = { ...config, fixedSeconds: 7 };
      assert.strictEqual(getAutoTurnDelayMs(99999, fixedConfig), 7000);
      assert.strictEqual(getAutoTurnDelayMs(0, fixedConfig), 7000);
    });

    test('respects custom min/max bounds', () => {
      const customConfig: AutoTurnConfig = {
        speedCharsPerMin: 600,
        minSeconds: 3,
        maxSeconds: 120,
        fixedSeconds: 0
      };
      // 600 chars at 600 chars/min = 60s, within [3, 120]
      assert.strictEqual(getAutoTurnDelayMs(600, customConfig), 60000);
      // 1 char → ~0.1s → clamped to 3s
      assert.strictEqual(getAutoTurnDelayMs(1, customConfig), 3000);
    });
  });
});
