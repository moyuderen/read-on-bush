import { commands, EventEmitter, window } from 'vscode';
import type { ExtensionContext, Pseudoterminal, Terminal, TerminalDimensions } from 'vscode';
import { Commands } from '../Commands';
import type { TerminalCamouflageStyle } from '../settings';
import type { ReadingDisplayState } from './types';
import {
  computeEffectiveLineWidth,
  formatCamouflageScreen,
  formatTerminalIdleScreen,
  getTextWidth,
  splitContent
} from './camouflageRender';

const terminalName = 'npm: watch';

// —— txt 专用分页：在扁平 contents[] 上按 process 游标取一屏（epub 不走这里）——

function getForwardChunkCount(state: ReadingDisplayState, lineWidth: number, lineCount: number): number {
  const targetWidth = lineWidth * lineCount;
  let contentWidth = 0;
  let chunkCount = 0;

  for (let index = state.process; index < state.contents.length; index++) {
    const chunk = state.contents[index];

    if (!chunk) {
      continue;
    }

    const chunkWidth = getTextWidth(chunk);

    if (chunkCount > 0 && contentWidth + chunkWidth > targetWidth) {
      break;
    }

    chunkCount++;
    contentWidth += chunkWidth;
  }

  return Math.max(chunkCount, 1);
}

function getBackwardChunkCount(state: ReadingDisplayState, lineWidth: number, lineCount: number): number {
  const targetWidth = lineWidth * lineCount;
  let contentWidth = 0;
  let chunkCount = 0;

  for (let index = state.process - 1; index >= 0; index--) {
    const chunk = state.contents[index];

    if (!chunk) {
      continue;
    }

    const chunkWidth = getTextWidth(chunk);

    if (chunkCount > 0 && contentWidth + chunkWidth > targetWidth) {
      break;
    }

    chunkCount++;
    contentWidth += chunkWidth;
  }

  return Math.max(chunkCount, 1);
}

function getTerminalContentLines(state: ReadingDisplayState, lineWidth: number, lineCount: number): string[] {
  const chunkCount = getForwardChunkCount(state, lineWidth, lineCount);
  const content = state.contents.slice(state.process, state.process + chunkCount).join('') || state.content;
  return splitContent(content, lineWidth).slice(0, lineCount);
}

export function getTerminalNextProcessStep(
  state: ReadingDisplayState,
  lineWidth: number,
  lineCount: number
): number {
  return getForwardChunkCount(state, lineWidth, lineCount);
}

export function getTerminalPrevProcessStep(
  state: ReadingDisplayState,
  lineWidth: number,
  lineCount: number
): number {
  return getBackwardChunkCount(state, lineWidth, lineCount);
}

/**
 * txt 的拼屏：算出本屏要显示的行 + txt 的 `current/total` 进度文案，
 * 再交给共享的 formatCamouflageScreen 画成日志。行为与重构前完全一致。
 */
export function formatTerminalCamouflageScreen(
  state: ReadingDisplayState,
  showProgress: boolean,
  lineWidth: number,
  lineCount: number,
  style: TerminalCamouflageStyle = 'buildLog'
): string {
  const contentLines = getTerminalContentLines(state, lineWidth, lineCount);
  const current = state.total > 0 ? Math.min(state.process + 1, state.total) : 0;
  const progressLabel = showProgress ? `  ${current}/${state.total}` : '';
  return formatCamouflageScreen(style, contentLines, progressLabel);
}

export class TerminalCamouflageDisplay implements Pseudoterminal {
  private readonly writeEmitter = new EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private lastState?: ReadingDisplayState;
  private lastShowProgress = false;
  private lastLineWidth = 0;
  private lastLineCount = 3;
  private lastStyle: TerminalCamouflageStyle = 'buildLog';
  private pendingOutput?: string;
  private opened = false;

  constructor(private readonly context: ExtensionContext) {}

  open() {
    this.opened = true;
    this.writeEmitter.fire(this.pendingOutput || formatTerminalIdleScreen(this.lastStyle));
    this.pendingOutput = undefined;
  }

  close() {
    this.opened = false;
    this.terminal = undefined;
  }

  setDimensions(dimensions: TerminalDimensions) {
    this.dimensions = dimensions;
    this.renderLastState();
  }

  handleInput(data: string) {
    if (data === '\x1b[C' || data.toLowerCase() === 'n') {
      commands.executeCommand(Commands.NextLine);
      return;
    }

    if (data === '\x1b[D' || data.toLowerCase() === 'p') {
      commands.executeCommand(Commands.PrevLine);
      return;
    }

    if (data.toLowerCase() === 'j') {
      commands.executeCommand(Commands.JumpLine);
      return;
    }

    if (data.toLowerCase() === 'q') {
      commands.executeCommand(Commands.Stop);
    }
  }

  render(
    state: ReadingDisplayState,
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ) {
    this.lastState = state;
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.lastStyle = style;
    this.ensureTerminal();
    this.write(
      formatTerminalCamouflageScreen(
        state,
        showProgress,
        this.getEffectiveLineWidth(lineWidth, style),
        lineCount,
        style
      )
    );
  }

  pause() {
    if (!this.terminal && !this.opened) {
      return;
    }

    this.write(formatTerminalIdleScreen(this.lastStyle));
  }

  reveal(
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ) {
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.lastStyle = style;
    this.ensureTerminal();

    if (this.lastState) {
      this.write(
        formatTerminalCamouflageScreen(
          this.lastState,
          showProgress,
          this.getEffectiveLineWidth(lineWidth, style),
          lineCount,
          style
        )
      );
      return;
    }

    this.write(formatTerminalIdleScreen(style));
  }

  hide() {
    this.pendingOutput = undefined;
    this.terminal?.dispose();
    this.terminal = undefined;
    this.opened = false;
  }

  getNextProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ): number {
    return getTerminalNextProcessStep(state, this.getEffectiveLineWidth(lineWidth, style), lineCount);
  }

  getPrevProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ): number {
    return getTerminalPrevProcessStep(state, this.getEffectiveLineWidth(lineWidth, style), lineCount);
  }

  private getEffectiveLineWidth(lineWidth: number, style: TerminalCamouflageStyle): number {
    return computeEffectiveLineWidth(lineWidth, this.dimensions?.columns, style);
  }

  private renderLastState() {
    if (!this.opened || !this.lastState) {
      return;
    }

    this.write(
      formatTerminalCamouflageScreen(
        this.lastState,
        this.lastShowProgress,
        this.getEffectiveLineWidth(this.lastLineWidth, this.lastStyle),
        this.lastLineCount,
        this.lastStyle
      )
    );
  }

  private ensureTerminal() {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }

    this.terminal = window.createTerminal({ name: terminalName, pty: this });
    this.context.subscriptions.push(this.terminal);
    this.terminal.show(true);
  }

  private write(text: string) {
    if (!this.opened) {
      this.pendingOutput = text;
      return;
    }

    this.writeEmitter.fire(text);
  }
}

// 保留对外 API：idle 屏现在由 camouflageRender 提供
export { formatTerminalIdleScreen } from './camouflageRender';
