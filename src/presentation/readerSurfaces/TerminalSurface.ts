import { commands, EventEmitter, window } from 'vscode';
import type {
  Disposable,
  Event,
  ExtensionContext,
  Pseudoterminal,
  Terminal,
  TerminalDimensions
} from 'vscode';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import {
  clearScreen,
  formatResolvedTerminalIdleScreen,
  formatResolvedTerminalTitle
} from '../reader/rendering';
import type { ReaderSurface, ReaderSurfaceFrame, SurfaceDimensions } from './ReaderSurface';

/**
 * 终端模式的显示载体：用 VS Code 集成终端 + Pseudoterminal 渲染伪装阅读内容。
 * ANSI 字符串直接写入终端，由终端模拟器解析颜色、光标和标题。
 *
 * 同时实现 Pseudoterminal（VS Code 终端契约）和 ReaderSurface（显示类依赖的接口）。
 * PTY 方法由 VS Code 调用；ReaderSurface 方法由显示类调用。
 */
export class TerminalSurface implements ReaderSurface, Pseudoterminal {
  private readonly resizeEmitter = new EventEmitter<SurfaceDimensions>();
  private readonly writeEmitter = new EventEmitter<string>();

  readonly onDidResize: Event<SurfaceDimensions> = this.resizeEmitter.event;
  readonly onDidWrite = this.writeEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private inputHandler?: (data: string) => void;
  private pendingOutput = '';
  private opened = false;
  private currentTerminalName?: string;

  constructor(private readonly context: ExtensionContext) {}

  // ── ReaderSurface ──────────────────────────────────────────────

  publishFrame(frame: ReaderSurfaceFrame): void {
    this.ensureTerminal();
    this.syncTerminalName(frame.template);
    this.write(frame.screen);
  }

  publishIdle(template: ResolvedTerminalTemplate): void {
    this.ensureTerminal();
    this.syncTerminalName(template);
    this.write(formatResolvedTerminalIdleScreen(template));
  }

  publishHint(text: string): void {
    this.ensureTerminal();
    this.write(`${clearScreen}${text}`);
  }

  clear(): void {
    this.pendingOutput = '';
    this.terminal?.dispose();
    this.terminal = undefined;
    this.opened = false;
    this.currentTerminalName = undefined;
  }

  setInputHandler(handler: ((data: string) => void) | undefined): void {
    this.inputHandler = handler;
  }

  focus(): void {
    if (!this.terminal) {
      return;
    }
    this.terminal.show(false);
    void commands.executeCommand('workbench.action.terminal.focus');
  }

  dispose(): void {
    this.clear();
    this.resizeEmitter.dispose();
    this.writeEmitter.dispose();
  }

  // ── Pseudoterminal（VS Code 终端契约） ─────────────────────────

  open(): void {
    this.opened = true;
    if (this.pendingOutput) {
      this.writeEmitter.fire(this.pendingOutput);
      this.pendingOutput = '';
    }
  }

  close(): void {
    this.opened = false;
    this.terminal = undefined;
  }

  setDimensions(dimensions: TerminalDimensions): void {
    this.dimensions = dimensions;
    this.resizeEmitter.fire(dimensions);
  }

  handleInput(data: string): void {
    this.inputHandler?.(data);
  }

  // ── 内部 ───────────────────────────────────────────────────────

  private ensureTerminal(): void {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }
    this.terminal = window.createTerminal({
      name: this.currentTerminalName ?? 'npm: watch',
      pty: this
    });
    this.context.subscriptions.push(this.terminal);
    this.terminal.show(true);
  }

  private syncTerminalName(template: ResolvedTerminalTemplate): void {
    const name = template.template.terminalName;
    if (this.currentTerminalName === name) {
      return;
    }
    this.currentTerminalName = name;
    this.write(formatResolvedTerminalTitle(template));
  }

  private write(text: string): void {
    if (!this.opened) {
      // 累积：终端未就绪时标题和屏幕都可能缓冲，不能覆盖。
      this.pendingOutput += text;
      return;
    }
    this.writeEmitter.fire(text);
  }
}
