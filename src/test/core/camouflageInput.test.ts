import * as assert from 'assert';
import { handleCamouflageInput } from '../../core/display/camouflageInput';

suite('camouflageInput', () => {
  test('ignores pasted or batched text instead of dispatching every character', () => {
    const calls: string[] = [];

    handleCamouflageInput('nqjqq', {
      next: () => calls.push('next'),
      prev: () => calls.push('prev'),
      jump: () => calls.push('jump'),
      toggleDebug: () => calls.push('debug'),
      quit: () => calls.push('quit')
    });

    assert.deepStrictEqual(calls, []);
  });

  test('maps arrows and single-letter keys to one command', () => {
    const calls: string[] = [];
    const handlers = {
      next: () => calls.push('next'),
      prev: () => calls.push('prev'),
      jump: () => calls.push('jump'),
      toggleDebug: () => calls.push('debug'),
      quit: () => calls.push('quit')
    };

    handleCamouflageInput('\x1b[C', handlers);
    handleCamouflageInput('\x1b[D', handlers);
    handleCamouflageInput('J', handlers);

    assert.deepStrictEqual(calls, ['next', 'prev', 'jump']);
  });

  test('notifies non-quit actions so stale quit confirmations can be cleared', () => {
    const calls: string[] = [];

    handleCamouflageInput('n', {
      next: () => calls.push('next'),
      prev: () => calls.push('prev'),
      jump: () => calls.push('jump'),
      toggleDebug: () => calls.push('debug'),
      quit: () => calls.push('quit'),
      onNonQuitKey: () => calls.push('clear')
    });

    assert.deepStrictEqual(calls, ['clear', 'next']);
  });
});
