import { commands } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { Commands } from '../../config/commands';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import { CamouflageDisplayBase } from './CamouflageDisplayBase';
import type { CamouflageInputHandlers } from '../readerControls';
import { createReaderSurfaceFrame, type ReaderSurface } from '../readerSurfaces';
import type { ReadingDisplayState } from './ReaderDisplayTypes';
import {
  computeResolvedEffectiveLineWidth,
  formatResolvedDebugCamouflageScreen,
  resolveBuiltinTemplate,
  updateTerminalTemplate
} from './rendering';
import {
  formatTerminalCamouflageScreen,
  getTerminalNextProcessStep,
  getTerminalPrevProcessStep
} from './CamouflagePagination';

export class TxtCamouflageDisplay extends CamouflageDisplayBase {
  private lastState?: ReadingDisplayState;
  private lastShowProgress = false;
  private lastLineWidth = 0;
  private lastLineCount = 3;
  private lastTemplate: ResolvedTerminalTemplate = resolveBuiltinTemplate('buildLog');

  constructor(context: ExtensionContext, readerView: ReaderSurface) {
    super(context, readerView, Commands.Stop);
  }

  render(
    state: ReadingDisplayState,
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    template: ResolvedTerminalTemplate
  ): void {
    this.lastState = state;
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.updateTemplate(template);
    this.open();
  }

  pause(): void {
    if (!this.opened && !this.lastState) {
      return;
    }

    this.deactivate();
    this.readerView.publishIdle(this.lastTemplate);
  }

  reveal(
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    template: ResolvedTerminalTemplate
  ): void {
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.updateTemplate(template);
    this.open();
  }

  protected getInputHandlers(): CamouflageInputHandlers {
    return {
      next: () => void commands.executeCommand(Commands.NextLine),
      prev: () => void commands.executeCommand(Commands.PrevLine),
      jump: () => void commands.executeCommand(Commands.JumpLine),
      toggleDebug: () => this.toggleDebugContent(),
      quit: () => this.concealController.handleQuitKey(),
      onNonQuitKey: () => this.concealController.clearPendingQuit()
    };
  }

  protected clearState(): void {
    this.lastState = undefined;
  }

  getNextProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    template: ResolvedTerminalTemplate
  ): number {
    return getTerminalNextProcessStep(state, this.getEffectiveLineWidth(lineWidth, template), lineCount);
  }

  getPrevProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    template: ResolvedTerminalTemplate
  ): number {
    return getTerminalPrevProcessStep(state, this.getEffectiveLineWidth(lineWidth, template), lineCount);
  }

  private getEffectiveLineWidth(
    lineWidth: number,
    template: ResolvedTerminalTemplate
  ): number {
    return computeResolvedEffectiveLineWidth(lineWidth, this.dimensions?.columns, template);
  }

  private updateTemplate(template: ResolvedTerminalTemplate): void {
    this.lastTemplate = updateTerminalTemplate(this.lastTemplate, template);
  }

  protected renderOrIdle(): void {
    if (!this.opened) {
      return;
    }

    if (this.lastState) {
      this.writeLastState();
      return;
    }

    if (this.concealController.mode === 'real') {
      this.readerView.publishIdle(this.lastTemplate);
      return;
    }

    const lineWidth = this.getEffectiveLineWidth(this.lastLineWidth, this.lastTemplate);
    const screen = formatResolvedDebugCamouflageScreen(
      this.lastTemplate,
      lineWidth,
      this.lastLineCount,
      this.dimensions?.columns
    );
    this.readerView.publishFrame(
      createReaderSurfaceFrame(screen, this.lastTemplate, this.concealController.mode)
    );
  }

  private writeLastState(): void {
    const screen = formatTerminalCamouflageScreen(
      this.lastState!,
      this.lastShowProgress,
      this.getEffectiveLineWidth(this.lastLineWidth, this.lastTemplate),
      this.lastLineCount,
      this.lastTemplate,
      this.dimensions?.columns,
      this.concealController.mode
    );
    this.readerView.publishFrame(
      createReaderSurfaceFrame(screen, this.lastTemplate, this.concealController.mode)
    );
  }
}
