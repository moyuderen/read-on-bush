import { commands, workspace } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { Commands } from '../../config/commands';
import { AppName } from '../../config/constants';
import {
  getCamouflageSurface,
  getDisplayTarget,
  getShowProgress,
  getTerminalCamouflageLineCount,
  getTerminalCamouflageLineWidth,
  getTerminalCamouflageTemplateSettings,
  shouldShowStatusBarReading,
  shouldShowTerminalCamouflage
} from '../../config/settings';
import { StatusBarDisplay } from './ReadingStatusBar';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { CamouflageTemplateService } from './rendering';
import type { PrivacyService } from '../../application/PrivacyService';
import { TxtCamouflageDisplay } from './TxtCamouflageDisplay';
import type { ReaderSurface } from '../readerSurfaces';
import type { ReadingDisplayState } from './ReaderDisplayTypes';

export class ReaderDisplayManager {
  private readonly statusBar: StatusBarDisplay;
  private readonly camouflageDisplay: TxtCamouflageDisplay;
  private lastState?: ReadingDisplayState;

  constructor(
    context: ExtensionContext,
    private readonly templateService: CamouflageTemplateService,
    private readonly privacyDisplay: PrivacyService,
    private readonly readerSurface: ReaderSurface
  ) {
    this.statusBar = new StatusBarDisplay(privacyDisplay);
    this.camouflageDisplay = new TxtCamouflageDisplay(context, readerSurface);

    context.subscriptions.push(
      this.camouflageDisplay.onDidConcealContent(() => this.statusBar.hide()),
      this.camouflageDisplay.onDidRevealContent(() => this.refresh()),
      commands.registerCommand(Commands.OpenTerminalCamouflage, () => {
        this.revealTerminal();
      }),
      commands.registerCommand(Commands.ToggleTerminalCamouflage, () => {
        this.toggleTerminalCamouflage();
      })
    );
  }

  showIdleHint(): void {
    const text =
      getCamouflageSurface() === 'terminal'
        ? '当前为终端模式，请在集成终端中阅读'
        : '请先从左侧书架选择一本书，开始阅读';
    this.readerSurface.publishHint(text);
  }

  render(state: ReadingDisplayState) {
    this.lastState = state;
    const showTerminalCamouflage = shouldShowTerminalCamouflage();
    const terminalConcealed =
      showTerminalCamouflage && !this.camouflageDisplay.isRealContentMode();

    if (shouldShowStatusBarReading() && !terminalConcealed) {
      this.statusBar.render(state);
    } else {
      this.statusBar.hide();
    }

    if (showTerminalCamouflage) {
      this.camouflageDisplay.render(
        state,
        getShowProgress(),
        getTerminalCamouflageLineWidth(),
        getTerminalCamouflageLineCount(),
        this.getResolvedTemplate()
      );
    } else {
      this.camouflageDisplay.hide();
    }
  }

  pause(state?: ReadingDisplayState) {
    this.lastState = state || this.lastState;
    this.statusBar.hide();
    this.camouflageDisplay.pause();
  }

  concealActive(): void {
    this.camouflageDisplay.concealContent();
  }

  revealActive(): void {
    this.camouflageDisplay.revealContent();
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
    const template = this.getResolvedTemplate();

    if (this.lastState && this.lastState.isReading) {
      this.camouflageDisplay.render(this.lastState, showProgress, lineWidth, lineCount, template);
      return;
    }

    this.camouflageDisplay.reveal(showProgress, lineWidth, lineCount, template);
  }

  getNextProcessStep(state: ReadingDisplayState): number {
    if (!shouldShowTerminalCamouflage()) {
      return 1;
    }

    return this.camouflageDisplay.getNextProcessStep(
      state,
      getTerminalCamouflageLineWidth(),
      getTerminalCamouflageLineCount(),
      this.getResolvedTemplate()
    );
  }

  getPrevProcessStep(state: ReadingDisplayState): number {
    if (!shouldShowTerminalCamouflage()) {
      return 1;
    }

    return this.camouflageDisplay.getPrevProcessStep(
      state,
      getTerminalCamouflageLineWidth(),
      getTerminalCamouflageLineCount(),
      this.getResolvedTemplate()
    );
  }

  private getResolvedTemplate(): ResolvedTerminalTemplate {
    const template = this.templateService.resolve(getTerminalCamouflageTemplateSettings());
    return this.privacyDisplay.applyTerminalPrivacy(template);
  }

  private async toggleTerminalCamouflage() {
    const currentTarget = getDisplayTarget();
    const nextTarget =
      currentTarget === 'terminalCamouflage' ? 'statusBar' : 'terminalCamouflage';
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
