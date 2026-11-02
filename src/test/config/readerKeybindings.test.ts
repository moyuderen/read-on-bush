import * as assert from 'assert';
import {
  DEFAULT_READER_KEYBINDINGS,
  resolveReaderKeybindings,
  formatReaderKeyHints
} from '../../config/readerKeybindings';

suite('Reader keybindings configuration', () => {
  test('partial overrides preserve defaults and normalize letter case', () => {
    const keys = resolveReaderKeybindings({ toggleDebug: '/', search: 'S' });
    assert.strictEqual(keys.toggleDebug, '/');
    assert.strictEqual(keys.search, 's');
    assert.strictEqual(keys.quit, 'q');
    assert.strictEqual(DEFAULT_READER_KEYBINDINGS.toggleDebug, 'd');
    assert.ok(formatReaderKeyHints(keys).includes('/ toggle'));
    assert.ok(formatReaderKeyHints(keys).includes('s search'));
  });

  test('allows swapping keys and changing the double-quit key', () => {
    const keys = resolveReaderKeybindings({ next: 'p', prev: 'n', quit: 'x' });
    assert.strictEqual(keys.next, 'p');
    assert.strictEqual(keys.prev, 'n');
    assert.ok(formatReaderKeyHints(keys).startsWith('x hide · xx quit'));
  });

  test('invalid or conflicting maps fall back atomically to safe defaults', () => {
    for (const value of [
      null, [], 'd', { toggleDebug: '' }, { toggleDebug: 'Ctrl+d' },
      { toggleDebug: '\u001b' }, { toggleDebug: ' ' }, { toggleDebug: '中' },
      { toggleDebug: 7 }, { toggleDebug: 'Q' }, { next: 'p' },
      { toggleDebug: '/', search: '/', quit: 'x' }
    ]) {
      assert.deepStrictEqual(resolveReaderKeybindings(value), DEFAULT_READER_KEYBINDINGS);
    }
  });
});
