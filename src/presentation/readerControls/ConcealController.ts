import type { TerminalCamouflageContentMode } from '../reader/rendering';

type CamouflageConcealControllerOptions = {
  render: () => void;
  stop: () => void;
  onConceal?: () => void;
  onReveal?: () => void;
};

const quitConfirmMs = 1500;

export class CamouflageConcealController {
  private contentMode: TerminalCamouflageContentMode = 'real';
  private pendingQuit = false;
  private quitConfirmTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: CamouflageConcealControllerOptions) {}

  get mode(): TerminalCamouflageContentMode {
    return this.contentMode;
  }

  isRealContentMode(): boolean {
    return this.contentMode === 'real';
  }

  toggleDebugContent(): void {
    this.clearPendingQuit();
    this.contentMode = this.contentMode === 'real' ? 'debugTemplate' : 'real';
    this.fireContentModeEvent();
    this.options.render();
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
    this.clearPendingQuit();

    if (shouldReveal) {
      this.options.onReveal?.();
    }
  }

  private showDebugContent(): void {
    if (this.contentMode !== 'debugTemplate') {
      this.contentMode = 'debugTemplate';
      this.options.onConceal?.();
    }

    this.options.render();
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

  private fireContentModeEvent(): void {
    if (this.isRealContentMode()) {
      this.options.onReveal?.();
      return;
    }

    this.options.onConceal?.();
  }
}
