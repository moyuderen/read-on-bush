/**
 * Coalesces rapid successive calls into a single execution.
 *
 * Each `schedule` replaces the pending task; the task only fires after `delayMs`
 * elapses with no new `schedule` call. `flush` forces the pending task to run
 * immediately — call it at critical moments (e.g. before closing a resource) so
 * no coalesced write is lost.
 */
export class DebouncedTask {
  private timer?: ReturnType<typeof setTimeout>;
  private pendingTask?: () => void;

  constructor(private readonly delayMs: number) {}

  schedule(task: () => void): void {
    this.pendingTask = task;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  /** Run the pending task immediately (if any) and cancel the timer. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const task = this.pendingTask;
    this.pendingTask = undefined;
    task?.();
  }

  dispose(): void {
    this.flush();
  }
}
