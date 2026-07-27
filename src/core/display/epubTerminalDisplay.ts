import { commands, EventEmitter, window } from 'vscode';
import type { ExtensionContext, Pseudoterminal, Terminal, TerminalDimensions } from 'vscode';
import { Commands } from '../Commands';
import type { TerminalCamouflageStyle } from '../settings';
import { CamouflageConcealController } from './camouflageConcealController';
import { handleCamouflageInput } from './camouflageInput';
import {
  computeEffectiveLineWidth,
  formatCamouflageScreen,
  formatDebugCamouflageScreen,
  formatTerminalIdleScreen,
  getTerminalName,
  updateTerminalStyle
} from './camouflageRender';
import type { EpubBook } from '../EpubBook';

/**
 * epub 专用伪装终端。与 txt 的 TerminalCamouflageDisplay 平行：
 * 自己的终端实例 / 生命周期 / handleInput（n/p/j/q → epub 命令），
 * 但画屏复用共享的 camouflageRender.formatCamouflageScreen——日志长相只有一份。
 */
export class EpubTerminalDisplay implements Pseudoterminal {
  private readonly writeEmitter = new EventEmitter<string>();
  private readonly concealEmitter = new EventEmitter<void>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidConcealContent = this.concealEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private epubBook?: EpubBook;
  private style: TerminalCamouflageStyle = 'buildLog';
  private lineWidth = 0;
  private lineCount = 3;
  private pendingOutput?: string;
  private opened = false;
  private readonly concealController = new CamouflageConcealController({
    render: () => this.renderOrIdle(),
    stop: () => commands.executeCommand(Commands.EpubStop),
    onConceal: () => this.concealEmitter.fire()
  });

  constructor(private readonly context: ExtensionContext) {}

  bind(
    epubBook: EpubBook,
    style: TerminalCamouflageStyle,
    lineWidth: number,
    lineCount: number
  ): void {
    this.epubBook = epubBook;
    this.updateStyle(style);
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
    this.concealController.reset();
  }

  updateSettings(style: TerminalCamouflageStyle, lineWidth: number, lineCount: number): void {
    this.updateStyle(style);
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
  }

  unbind(): void {
    this.epubBook = undefined;
    this.concealController.reset();
    this.write(formatTerminalIdleScreen(this.style));
  }

  getEffectiveLineWidth(): number {
    return computeEffectiveLineWidth(this.lineWidth, this.dimensions?.columns, this.style);
  }

  getLineCount(): number {
    return this.lineCount;
  }

  isRealContentMode(): boolean {
    return this.concealController.isRealContentMode();
  }

  open(): void {
    this.opened = true;
    this.writeEmitter.fire(this.pendingOutput || formatTerminalIdleScreen(this.style));
    this.pendingOutput = undefined;
  }

  close(): void {
    this.opened = false;
    this.terminal = undefined;
    this.concealController.reset();
  }

  setDimensions(dimensions: TerminalDimensions): void {
    this.dimensions = dimensions;
    this.render();
  }

  handleInput(data: string): void {
    handleCamouflageInput(data, {
      next: () => this.executeRealContentCommand(Commands.EpubNext),
      prev: () => this.executeRealContentCommand(Commands.EpubPrev),
      jump: () => this.executeRealContentCommand(Commands.EpubJumpChapter),
      toggleDebug: () => this.toggleDebugContent(),
      quit: () => this.concealController.handleQuitKey(),
      viewImage: () => this.executeRealContentCommand(Commands.EpubViewImage),
      onNonQuitKey: () => this.concealController.clearPendingQuit()
    });
  }

  render(): void {
    if (!this.epubBook) {
      return;
    }
    this.ensureTerminal();
    const effectiveWidth = this.getEffectiveLineWidth();
    const contentMode = this.concealController.mode;

    if (contentMode === 'debugTemplate') {
      this.write(formatDebugCamouflageScreen(this.style, effectiveWidth, this.lineCount, this.dimensions?.columns));
      return;
    }

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

  toggleDebugContent(): void {
    this.concealController.toggleDebugContent();
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
    this.concealController.reset();
  }

  private executeRealContentCommand(command: Commands): void {
    if (this.isRealContentMode()) {
      commands.executeCommand(command);
    }
  }

  private updateStyle(style: TerminalCamouflageStyle): void {
    this.style = updateTerminalStyle(
      this.style,
      style,
      this.terminal ? (title) => this.write(title) : undefined
    );
  }

  private renderOrIdle(): void {
    this.ensureTerminal();
    if (this.epubBook) {
      this.render();
      return;
    }

    if (this.concealController.mode === 'debugTemplate') {
      this.write(formatDebugCamouflageScreen(this.style, this.getEffectiveLineWidth(), this.lineCount, this.dimensions?.columns));
      return;
    }

    this.write(formatTerminalIdleScreen(this.style));
  }

  private ensureTerminal(): void {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }
    this.terminal = window.createTerminal({ name: getTerminalName(this.style), pty: this });
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
