/**
 * 自动翻页调度器。
 *
 * 管理 idle / running / paused 三态生命周期和可冻结的单次定时器。
 * - start：按当前页可见字符数计算停留时间，启动定时器。
 * - pause：冻结剩余时间（deadline - now），清除定时器。
 * - resume：用冻结的剩余时间重新启动定时器。
 * - 手动导航时调用 pauseIfRunning，暂停但保留剩余时间。
 * - 定时器触发后翻页：成功则为新页重新计时，到达末页或异常则停止。
 */

import { countVisibleCharacters, getAutoTurnDelayMs, type AutoTurnConfig } from './AutoTurnStrategy';

export type AutoTurnState = 'idle' | 'running' | 'paused';

export type AutoTurnSchedulerCallbacks = {
  /** 翻到下一页。返回 false 表示已到末页。 */
  turnPage(): Promise<boolean>;
  /** 返回当前页的可见文本，用于计算停留时间。 */
  getVisibleText(): string;
  /** 状态变化回调。 */
  onStateChange?(state: AutoTurnState): void;
  /** 翻页过程中抛出异常时的回调。 */
  onError?(error: unknown): void;
};

export class AutoTurnScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private state: AutoTurnState = 'idle';
  private deadline?: number;
  private remainingMs = 0;

  constructor(
    private readonly callbacks: AutoTurnSchedulerCallbacks,
    private readonly getConfig: () => AutoTurnConfig
  ) {}

  get currentState(): AutoTurnState {
    return this.state;
  }

  get isRunning(): boolean {
    return this.state === 'running';
  }

  /** idle→start, running→pause, paused→resume。 */
  toggle(): void {
    if (this.state === 'idle') {
      this.start();
    } else if (this.state === 'running') {
      this.pause();
    } else {
      this.resume();
    }
  }

  start(): void {
    if (this.state !== 'idle') {
      return;
    }
    this.remainingMs = this.computeDelayMs();
    this.state = 'running';
    this.scheduleTimer(this.remainingMs);
    this.fireStateChange();
  }

  pause(): void {
    if (this.state !== 'running') {
      return;
    }
    this.clearTimer();
    if (this.deadline !== undefined) {
      this.remainingMs = Math.max(0, this.deadline - Date.now());
    }
    this.state = 'paused';
    this.fireStateChange();
  }

  resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    this.state = 'running';
    this.scheduleTimer(this.remainingMs);
    this.fireStateChange();
  }

  stop(): void {
    this.clearTimer();
    if (this.state === 'idle') {
      return;
    }
    this.state = 'idle';
    this.remainingMs = 0;
    this.deadline = undefined;
    this.fireStateChange();
  }

  /** 手动导航时调用：仅在 running 时暂停，冻结剩余时间。 */
  pauseIfRunning(): void {
    if (this.state === 'running') {
      this.pause();
    }
  }

  dispose(): void {
    this.stop();
  }

  private computeDelayMs(): number {
    const text = this.callbacks.getVisibleText();
    const chars = countVisibleCharacters(text);
    return getAutoTurnDelayMs(chars, this.getConfig());
  }

  private scheduleTimer(ms: number): void {
    this.clearTimer();
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => void this.handleTimer(), ms);
  }

  private async handleTimer(): Promise<void> {
    this.timer = undefined;
    this.deadline = undefined;
    try {
      const advanced = await this.callbacks.turnPage();
      if (!advanced) {
        this.state = 'idle';
        this.remainingMs = 0;
        this.fireStateChange();
        return;
      }
      this.remainingMs = this.computeDelayMs();
      this.scheduleTimer(this.remainingMs);
    } catch (error) {
      this.state = 'idle';
      this.remainingMs = 0;
      this.fireStateChange();
      this.callbacks.onError?.(error);
    }
  }

  private fireStateChange(): void {
    this.callbacks.onStateChange?.(this.state);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
