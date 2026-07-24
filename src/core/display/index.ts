import { commands, workspace } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { Commands } from '../Commands';
import { AppName } from '../config';
import {
  getDisplayTarget,
  getShowProgress,
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageStyle,
  shouldShowStatusBarReading,
  shouldShowTerminalCamouflage
} from '../settings';
import { StatusBarDisplay } from './statusBarDisplay';
import { TerminalCamouflageDisplay } from './terminalCamouflageDisplay';
import type { ReadingDisplayState } from './types';

export class ReadingDisplayManager {
  private readonly statusBarDisplay = new StatusBarDisplay();
  private readonly terminalCamouflageDisplay: TerminalCamouflageDisplay;
  private lastState?: ReadingDisplayState;

  constructor(context: ExtensionContext) {
    this.terminalCamouflageDisplay = new TerminalCamouflageDisplay(context);

    context.subscriptions.push(
      this.terminalCamouflageDisplay.onDidConcealContent(() => this.statusBarDisplay.hide()),
      this.terminalCamouflageDisplay.onDidRevealContent(() => this.refresh()),
      commands.registerCommand(Commands.OpenTerminalCamouflage, () => {
        this.revealTerminal();
      }),
      commands.registerCommand(Commands.ToggleTerminalCamouflage, () => {
        this.toggleTerminalCamouflage();
      })
    );
  }

  render(state: ReadingDisplayState) {
    this.lastState = state;
    const showTerminalCamouflage = shouldShowTerminalCamouflage();
    const terminalConcealed = showTerminalCamouflage && !this.terminalCamouflageDisplay.isRealContentMode();

    if (shouldShowStatusBarReading() && !terminalConcealed) {
      this.statusBarDisplay.render(state);
    } else {
      this.statusBarDisplay.hide();
    }

    if (showTerminalCamouflage) {
      this.terminalCamouflageDisplay.render(
        state,
        getShowProgress(),
        getTerminalCamouflageLineWidth(),
        getTerminalCamouflageLineCount(),
        getTerminalCamouflageStyle()
      );
    } else {
      this.terminalCamouflageDisplay.hide();
    }
  }

  pause(state?: ReadingDisplayState) {
    this.lastState = state || this.lastState;
    this.statusBarDisplay.hide();
    this.terminalCamouflageDisplay.pause();
  }

  refresh(state?: ReadingDisplayState) {
    const currentState = state || this.lastState;

    if (!currentState || !currentState.isReading) {
      this.pause(currentState);
      return;
    }

    this.render(currentState);
  }

  revealTerminal() {
    const showProgress = getShowProgress();
    const lineWidth = getTerminalCamouflageLineWidth();
    const lineCount = getTerminalCamouflageLineCount();
    const style = getTerminalCamouflageStyle();

    if (this.lastState && this.lastState.isReading) {
      this.terminalCamouflageDisplay.render(this.lastState, showProgress, lineWidth, lineCount, style);
      return;
    }

    this.terminalCamouflageDisplay.reveal(showProgress, lineWidth, lineCount, style);
  }

  getNextProcessStep(state: ReadingDisplayState): number {
    if (!shouldShowTerminalCamouflage()) {
      return 1;
    }

    return this.terminalCamouflageDisplay.getNextProcessStep(
      state,
      getTerminalCamouflageLineWidth(),
      getTerminalCamouflageLineCount(),
      getTerminalCamouflageStyle()
    );
  }

  getPrevProcessStep(state: ReadingDisplayState): number {
    if (!shouldShowTerminalCamouflage()) {
      return 1;
    }

    return this.terminalCamouflageDisplay.getPrevProcessStep(
      state,
      getTerminalCamouflageLineWidth(),
      getTerminalCamouflageLineCount(),
      getTerminalCamouflageStyle()
    );
  }

  private async toggleTerminalCamouflage() {
    const currentTarget = getDisplayTarget();
    const nextTarget =
      currentTarget === 'terminalCamouflage' || currentTarget === 'both'
        ? 'statusBar'
        : 'terminalCamouflage';
    const configuration = workspace.getConfiguration(AppName);
    const inspected = configuration.inspect('displayTarget');
    const updateGlobal = inspected?.workspaceValue === undefined;

    await configuration.update('displayTarget', nextTarget, updateGlobal);
    this.refresh();

    if (nextTarget === 'terminalCamouflage') {
      this.revealTerminal();
    }
  }
}

export type { ReadingDisplayState } from './types';
