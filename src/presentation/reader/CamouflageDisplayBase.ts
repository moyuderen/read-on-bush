import { commands, EventEmitter } from 'vscode';
import type { Disposable, ExtensionContext } from 'vscode';
import { CamouflageConcealController, handleCamouflageInput } from '../readerControls';
import type { CamouflageInputHandlers } from '../readerControls';
import type { ReaderSurface, SurfaceDimensions } from '../readerSurfaces';

export abstract class CamouflageDisplayBase {
  private readonly concealEmitter = new EventEmitter<void>();
  private readonly revealEmitter = new EventEmitter<void>();
  protected readonly concealController: CamouflageConcealController;
  protected dimensions?: SurfaceDimensions;
  protected opened = false;
  protected readonly readerView: ReaderSurface;
  private readonly handleInputBound = (data: string) => this.handleInput(data);
  private readonly resizeDisposable: Disposable;

  readonly onDidConcealContent = this.concealEmitter.event;
  readonly onDidRevealContent = this.revealEmitter.event;

  protected constructor(
    context: ExtensionContext | undefined,
    readerView: ReaderSurface,
    stopCommand: string
  ) {
    this.readerView = readerView;
    this.concealController = new CamouflageConcealController({
      render: () => this.renderOrIdle(),
      stop: () => void commands.executeCommand(stopCommand),
      onConceal: () => this.concealEmitter.fire(),
      onReveal: () => this.revealEmitter.fire()
    });

    this.resizeDisposable = readerView.onDidResize((dimensions) => {
      this.dimensions = dimensions;
      if (this.opened) {
        this.renderOrIdle();
      }
    });
    context?.subscriptions.push(this.resizeDisposable);
  }

  open(): void {
    this.opened = true;
    this.readerView.setInputHandler(this.handleInputBound);
    this.renderOrIdle();
  }

  close(): void {
    this.deactivate();
    this.readerView.clear();
  }

  handleInput(data: string): void {
    if (!this.opened) {
      return;
    }

    handleCamouflageInput(data, this.getInputHandlers());
  }

  hide(): void {
    this.clearState();
    this.deactivate();
    this.readerView.clear();
  }

  dispose(): void {
    this.deactivate();
    this.resizeDisposable.dispose();
    this.concealEmitter.dispose();
    this.revealEmitter.dispose();
  }

  toggleDebugContent(): void {
    this.concealController.toggleDebugContent();
  }

  isRealContentMode(): boolean {
    return this.concealController.isRealContentMode();
  }

  protected executeRealContentCommand(command: string): void {
    if (this.isRealContentMode()) {
      void commands.executeCommand(command);
    }
  }

  focus(): void {
    this.readerView.focus();
  }

  protected deactivate(): void {
    this.opened = false;
    this.readerView.setInputHandler(undefined);
    this.concealController.reset();
  }

  protected clearState(): void {}

  protected abstract getInputHandlers(): CamouflageInputHandlers;
  protected abstract renderOrIdle(): void;
}
