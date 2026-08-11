import * as assert from 'assert';
import { DebouncedTask } from '../../utils/debounce';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('DebouncedTask', () => {
  it('coalesces rapid successive calls into one execution', async () => {
    const calls: number[] = [];
    const task = new DebouncedTask(30);

    task.schedule(() => calls.push(1));
    task.schedule(() => calls.push(2));
    task.schedule(() => calls.push(3));

    assert.deepStrictEqual(calls, []);
    await wait(60);
    assert.deepStrictEqual(calls, [3]);

    task.dispose();
  });

  it('runs the pending task immediately on flush', () => {
    const calls: string[] = [];
    const task = new DebouncedTask(1000);

    task.schedule(() => calls.push('a'));
    task.flush();

    assert.deepStrictEqual(calls, ['a']);
    task.dispose();
  });

  it('does nothing when flush is called with no pending task', () => {
    let called = false;
    const task = new DebouncedTask(10);

    task.flush();
    assert.strictEqual(called, false);

    // Set flag inside a task that should never fire after flush clears the timer.
    task.schedule(() => {
      called = true;
    });
    task.flush();
    assert.strictEqual(called, true);

    task.dispose();
  });

  it('does not fire again after flush', async () => {
    const calls: number[] = [];
    const task = new DebouncedTask(20);

    task.schedule(() => calls.push(1));
    task.flush();
    assert.deepStrictEqual(calls, [1]);

    // After flush the timer is cleared — waiting should not produce a second call.
    await wait(50);
    assert.deepStrictEqual(calls, [1]);

    task.dispose();
  });

  it('flushes the pending task on dispose', () => {
    const calls: string[] = [];
    const task = new DebouncedTask(1000);

    task.schedule(() => calls.push('final'));
    task.dispose();

    assert.deepStrictEqual(calls, ['final']);
  });

  it('reschedules when a new call arrives during the wait window', async () => {
    const calls: number[] = [];
    const task = new DebouncedTask(40);

    task.schedule(() => calls.push(1));
    await wait(20);
    task.schedule(() => calls.push(2));
    await wait(30); // Not enough time since the second schedule.
    assert.deepStrictEqual(calls, []);
    await wait(30);

    assert.deepStrictEqual(calls, [2]);
    task.dispose();
  });
});
