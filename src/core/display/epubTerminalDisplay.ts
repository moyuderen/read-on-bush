import { commands, EventEmitter, window } from 'vscode';
import type { ExtensionContext, Pseudoterminal, Terminal, TerminalDimensions } from 'vscode';
import { Commands } from '../Commands';
import type { TerminalCamouflageStyle } from '../settings';
import {
  computeEffectiveLineWidth,
  formatCamouflageScreen,
  formatTerminalIdleScreen
} from './camouflageRender';
import type { EpubBook } from '../EpubBook';

// epub 伪装终端名，区别于 txt 的 'npm: watch'（两终端不串味）
const epubTerminalName = 'Claude Code';

/**
 * epub 专用伪装终端。与 txt 的 TerminalCamouflageDisplay 平行：
 * 自己的终端实例 / 生命周期 / handleInput（n/p/j/q → epub 命令），
 * 但画屏复用共享的 camouflageRender.formatCamouflageScreen——日志长相只有一份。
 */
export class EpubTerminalDisplay implements Pseudoterminal {
  private readonly writeEmitter = new EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private epubBook?: EpubBook;
  private style: TerminalCamouflageStyle = 'buildLog';
  private lineWidth = 0;
  private lineCount = 3;
  private pendingOutput?: string;
  private opened = false;

  constructor(private readonly context: ExtensionContext) {}

  bind(
    epubBook: EpubBook,
    style: TerminalCamouflageStyle,
    lineWidth: number,
    lineCount: number
  ): void {
    this.epubBook = epubBook;
    this.style = style;
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
  }

  updateSettings(style: TerminalCamouflageStyle, lineWidth: number, lineCount: number): void {
    this.style = style;
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
  }

  unbind(): void {
    this.epubBook = undefined;
    this.write(formatTerminalIdleScreen(this.style));
  }

  getEffectiveLineWidth(): number {
    return computeEffectiveLineWidth(this.lineWidth, this.dimensions?.columns, this.style);
  }

  getLineCount(): number {
    return this.lineCount;
  }

  open(): void {
    this.opened = true;
    this.writeEmitter.fire(this.pendingOutput || formatTerminalIdleScreen(this.style));
    this.pendingOutput = undefined;
  }

  close(): void {
    this.opened = false;
    this.terminal = undefined;
  }

  setDimensions(dimensions: TerminalDimensions): void {
    this.dimensions = dimensions;
    this.render();
  }

  handleInput(data: string): void {
    if (data === '\x1b[C' || data.toLowerCase() === 'n') {
      commands.executeCommand(Commands.EpubNext);
      return;
    }

    if (data === '\x1b[D' || data.toLowerCase() === 'p') {
      commands.executeCommand(Commands.EpubPrev);
      return;
    }

    if (data.toLowerCase() === 'j') {
      commands.executeCommand(Commands.EpubJumpChapter);
      return;
    }

    if (data.toLowerCase() === 'i') {
      commands.executeCommand(Commands.EpubViewImage);
      return;
    }

    if (data.toLowerCase() === 'q') {
      commands.executeCommand(Commands.EpubStop);
    }
  }

  render(): void {
    if (!this.epubBook) {
      return;
    }
    this.ensureTerminal();
    const effectiveWidth = this.getEffectiveLineWidth();
    const screen = this.epubBook.getScreen(effectiveWidth, this.lineCount);
    const progressLabel =
      screen.images.length > 0 ? `${screen.progressLabel} · [图 i]` : screen.progressLabel;
    this.write(formatCamouflageScreen(this.style, screen.lines, progressLabel, this.dimensions?.columns));
  }

  reveal(): void {
    this.ensureTerminal();
    if (this.epubBook) {
      this.render();
    } else {
      this.write(formatTerminalIdleScreen(this.style));
    }
  }

  /** 把焦点拉回伪装终端（看图面板关闭后调用，便于立即再按 i 重开）。 */
  focus(): void {
    if (!this.terminal) {
      return;
    }
    this.terminal.show(false);
    void commands.executeCommand('workbench.action.terminal.focus');
  }

  hide(): void {
    this.pendingOutput = undefined;
    this.terminal?.dispose();
    this.terminal = undefined;
    this.opened = false;
  }

  private ensureTerminal(): void {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }
    this.terminal = window.createTerminal({ name: epubTerminalName, pty: this });
    this.context.subscriptions.push(this.terminal);
    this.terminal.show(true);
  }

  private write(text: string): void {
    if (!this.opened) {
      this.pendingOutput = text;
      return;
    }
    this.writeEmitter.fire(text);
  }
}
