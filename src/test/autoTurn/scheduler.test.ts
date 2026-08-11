import * as assert from 'assert';
import {
  AutoTurnScheduler,
  type AutoTurnState
} from '../../domain/autoTurn/AutoTurnScheduler';
import { defaultAutoTurnConfig } from '../../domain/autoTurn/AutoTurnStrategy';

/**
 * 用手动控制的 fake timers 测试调度器，避免依赖 sinon。
 * setup/teardown 中接管 setTimeout / clearTimeout / Date.now。
 */

type ScheduledFn = () => void;

class FakeTimerController {
  private nextId = 1;
  readonly timeouts = new Map<number, { fn: ScheduledFn; created: number }>();
  now = 1000;

  setTimeout(fn: ScheduledFn, _ms: number): number {
    const id = this.nextId++;
    this.timeouts.set(id, { fn, created: this.now });
    return id;
  }

  clearTimeout(id: number): void {
    this.timeouts.delete(id);
  }

  /** 触发最早注册的定时器。 */
  fireNext(): void {
    let earliestId = -1;
    let earliestTime = Infinity;
    for (const [id, entry] of this.timeouts) {
      if (entry.created < earliestTime) {
        earliestTime = entry.created;
        earliestId = id;
      }
    }
    if (earliestId !== -1) {
      const entry = this.timeouts.get(earliestId)!;
      this.timeouts.delete(earliestId);
      entry.fn();
    }
  }

  advance(ms: number): void {
    this.now += ms;
  }

  get pendingCount(): number {
    return this.timeouts.size;
  }
}

suite('AutoTurnScheduler', () => {
  let fake: FakeTimerController;
  let originalSetTimeout: typeof setTimeout;
  let originalClearTimeout: typeof clearTimeout;
  let originalDateNow: typeof Date.now;

  setup(() => {
    fake = new FakeTimerController();
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    originalDateNow = Date.now;

    global.setTimeout = ((fn: ScheduledFn, ms?: number) =>
      fake.setTimeout(fn, ms ?? 0)) as unknown as typeof setTimeout;
    global.clearTimeout = ((id: number) =>
      fake.clearTimeout(id)) as unknown as typeof clearTimeout;
    Date.now = () => fake.now;
  });

  teardown(() => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    Date.now = originalDateNow;
  });

  function createScheduler(callbacks: {
    turnPage: () => Promise<boolean>;
    getVisibleText?: () => string;
    onStateChange?: (state: AutoTurnState) => void;
    onError?: (error: unknown) => void;
  }): AutoTurnScheduler {
    return new AutoTurnScheduler(
      {
        turnPage: callbacks.turnPage,
        getVisibleText: callbacks.getVisibleText ?? (() => '一些文字'),
        onStateChange: callbacks.onStateChange,
        onError: callbacks.onError
      },
      () => defaultAutoTurnConfig
    );
  }

  /** handleTimer 是 async，fireNext 触发后需要刷新微任务队列。 */
  function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  test('toggle cycles through idle → running → paused → running', () => {
    const states: AutoTurnState[] = [];
    const scheduler = createScheduler({
      turnPage: async () => true,
      onStateChange: (s) => states.push(s)
    });

    assert.strictEqual(scheduler.currentState, 'idle');
    assert.strictEqual(fake.pendingCount, 0);

    scheduler.toggle(); // idle → running
    assert.strictEqual(scheduler.currentState, 'running');
    assert.strictEqual(fake.pendingCount, 1);

    scheduler.toggle(); // running → paused
    assert.strictEqual(scheduler.currentState, 'paused');
    assert.strictEqual(fake.pendingCount, 0);

    scheduler.toggle(); // paused → running
    assert.strictEqual(scheduler.currentState, 'running');
    assert.strictEqual(fake.pendingCount, 1);

    assert.deepStrictEqual(states, ['running', 'paused', 'running']);
  });

  test('timer fires and advances page, then reschedules', async () => {
    let turnCount = 0;
    const scheduler = createScheduler({
      turnPage: async () => {
        turnCount++;
        return true;
      }
    });

    scheduler.start();
    assert.strictEqual(fake.pendingCount, 1);

    fake.fireNext(); // 第一定时器触发 → 翻页 → 重新调度
    await flushMicrotasks();
    assert.strictEqual(turnCount, 1);
    assert.strictEqual(scheduler.currentState, 'running');
    assert.strictEqual(fake.pendingCount, 1);
  });

  test('stops when turnPage returns false (at end)', async () => {
    const states: AutoTurnState[] = [];
    const scheduler = createScheduler({
      turnPage: async () => false,
      onStateChange: (s) => states.push(s)
    });

    scheduler.start();
    assert.strictEqual(scheduler.currentState, 'running');

    fake.fireNext();
    await flushMicrotasks();
    assert.strictEqual(scheduler.currentState, 'idle');
    assert.strictEqual(fake.pendingCount, 0);
    assert.deepStrictEqual(states, ['running', 'idle']);
  });

  test('pause freezes remaining time', async () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    scheduler.start();
    // 文本 '一些文字' = 4 chars, 4/450*60 = 0.53s → clamped to min 2s = 2000ms
    assert.strictEqual(fake.pendingCount, 1);

    fake.advance(500); // 过了 500ms
    scheduler.pause();
    assert.strictEqual(scheduler.currentState, 'paused');
    assert.strictEqual(fake.pendingCount, 0);

    // 恢复
    scheduler.resume();
    assert.strictEqual(scheduler.currentState, 'running');
    assert.strictEqual(fake.pendingCount, 1);

    // 触发定时器应翻页成功
    fake.fireNext();
    await flushMicrotasks();
    assert.strictEqual(scheduler.currentState, 'running');
  });

  test('pauseIfRunning only pauses when running', () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    // idle 时调用不产生效果
    scheduler.pauseIfRunning();
    assert.strictEqual(scheduler.currentState, 'idle');

    scheduler.start();
    assert.strictEqual(scheduler.currentState, 'running');

    scheduler.pauseIfRunning();
    assert.strictEqual(scheduler.currentState, 'paused');
  });

  test('stop resets to idle and clears timer', () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    scheduler.start();
    assert.strictEqual(fake.pendingCount, 1);

    scheduler.stop();
    assert.strictEqual(scheduler.currentState, 'idle');
    assert.strictEqual(fake.pendingCount, 0);
  });

  test('start is no-op when not idle', () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    scheduler.start();
    assert.strictEqual(fake.pendingCount, 1);

    scheduler.start(); // no-op
    assert.strictEqual(fake.pendingCount, 1);
  });

  test('error during turnPage stops and notifies', async () => {
    const states: AutoTurnState[] = [];
    let errorCaught: unknown;
    const scheduler = createScheduler({
      turnPage: async () => {
        throw new Error('翻页失败');
      },
      onStateChange: (s) => states.push(s),
      onError: (e) => {
        errorCaught = e;
      }
    });

    scheduler.start();
    fake.fireNext();
    await flushMicrotasks();

    assert.strictEqual(scheduler.currentState, 'idle');
    assert.strictEqual(fake.pendingCount, 0);
    assert.ok(errorCaught instanceof Error);
    assert.strictEqual((errorCaught as Error).message, '翻页失败');
  });

  test('dispose stops the scheduler', () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    scheduler.start();
    assert.strictEqual(fake.pendingCount, 1);

    scheduler.dispose();
    assert.strictEqual(scheduler.currentState, 'idle');
    assert.strictEqual(fake.pendingCount, 0);
  });

  test('toggle from paused resumes with frozen remaining time', () => {
    const scheduler = createScheduler({
      turnPage: async () => true
    });

    scheduler.start();
    fake.advance(300);
    scheduler.toggle(); // running → paused
    assert.strictEqual(scheduler.currentState, 'paused');

    scheduler.toggle(); // paused → running
    assert.strictEqual(scheduler.currentState, 'running');
    assert.strictEqual(fake.pendingCount, 1);
  });
});
