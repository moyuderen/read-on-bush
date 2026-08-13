import type { TerminalCamouflageContentMode } from '../reader/rendering';

export type ConcealOrigin = 'auto' | 'manual';

type CamouflageConcealControllerOptions = {
  render: () => void;
  stop: () => void;
  onConceal?: () => void;
  onReveal?: () => void;
};

const quitConfirmMs = 1500;

export class CamouflageConcealController {
  private contentMode: TerminalCamouflageContentMode = 'real';
  private concealOriginValue: ConcealOrigin | undefined;
  private pendingQuit = false;
  private quitConfirmTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: CamouflageConcealControllerOptions) {}

  get mode(): TerminalCamouflageContentMode {
    return this.contentMode;
  }

  get concealOrigin(): ConcealOrigin | undefined {
    return this.concealOriginValue;
  }

  isRealContentMode(): boolean {
    return this.contentMode === 'real';
  }

  toggleDebugContent(): void {
    this.clearPendingQuit();
    if (this.contentMode === 'real') {
      this.conceal('manual');
    } else {
      this.reveal();
    }
  }

  handleQuitKey(): void {
    if (this.pendingQuit) {
      this.clearPendingQuit();
      this.options.stop();
      return;
    }

    this.showDebugContent();
    this.armQuitConfirmation();
  }

  reset(): void {
    const shouldReveal = this.contentMode !== 'real';
    this.contentMode = 'real';
    this.concealOriginValue = undefined;
    this.clearPendingQuit();

    if (shouldReveal) {
      this.options.onReveal?.();
    }
  }

  /**
   * 强制切换到占位内容。若已在占位模式则保持现有来源不变（幂等），返回 false。
   * 用于失焦/闲置等自动隐蔽场景——不会覆盖用户手动隐蔽时记录的 'manual' 来源。
   */
  conceal(origin: ConcealOrigin): boolean {
    if (this.contentMode !== 'real') {
      return false;
    }

    this.contentMode = 'debugTemplate';
    this.concealOriginValue = origin;
    this.options.onConceal?.();
    this.options.render();
    return true;
  }

  /**
   * 强制切换回真实内容。若已在真实模式则返回 false（幂等）。
   * 传入 onlyIfOrigin 时，仅当当前隐蔽来源匹配才恢复——用于自动恢复只作用于
   * 'auto' 来源的隐蔽，不误恢复用户手动按 q/d 隐蔽的内容。
   */
  reveal(onlyIfOrigin?: ConcealOrigin): boolean {
    if (this.contentMode !== 'debugTemplate') {
      return false;
    }

    if (onlyIfOrigin !== undefined && this.concealOriginValue !== onlyIfOrigin) {
      return false;
    }

    this.contentMode = 'real';
    this.concealOriginValue = undefined;
    this.options.onReveal?.();
    this.options.render();
    return true;
  }

  private showDebugContent(): void {
    if (!this.conceal('manual')) {
      this.concealOriginValue = 'manual';
      this.options.render();
    }
  }

  private armQuitConfirmation(): void {
    this.pendingQuit = true;
    this.quitConfirmTimer = setTimeout(() => {
      this.pendingQuit = false;
      this.quitConfirmTimer = undefined;
    }, quitConfirmMs);
  }

  clearPendingQuit(): void {
    this.pendingQuit = false;

    if (this.quitConfirmTimer) {
      clearTimeout(this.quitConfirmTimer);
      this.quitConfirmTimer = undefined;
    }
  }
}
