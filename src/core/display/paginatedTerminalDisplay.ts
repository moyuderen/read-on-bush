import { commands, EventEmitter, window } from 'vscode';
import type { ExtensionContext, Pseudoterminal, Terminal, TerminalDimensions } from 'vscode';
import type { ResolvedTerminalTemplate } from './camouflageTemplates';
import { CamouflageConcealController } from './camouflageConcealController';
import { handleCamouflageInput } from './camouflageInput';
import {
  computeResolvedEffectiveLineWidth,
  formatResolvedCamouflageScreen,
  formatResolvedDebugCamouflageScreen,
  formatResolvedTerminalIdleScreen,
  resolveBuiltinTemplate,
  updateTerminalTemplate
} from './camouflageRender';

/**
 * 分页阅读的伪装终端（epub / pdf 共用）。由 epubTerminalDisplay 泛化而来：
 * - 不再依赖具体的 EpubBook，只依赖 PaginatedBook.getScreen()；
 * - 按键 → 命令的映射由构造时注入的 commandIds 决定（epub/pdf 各传各的）。
 * 画屏复用共享的 camouflageRender.formatCamouflageScreen——日志长相只有一份。
 */

export type PaginatedScreen = {
  lines: string[];
  images: readonly unknown[];
  progressLabel: string;
};

export interface PaginatedBook {
  getScreen(lineWidth: number, lineCount: number): PaginatedScreen;
}

export type PaginatedCommandIds = {
  next: string;
  prev: string;
  jump: string;
  stop: string;
  viewImage: string;
};

export class PaginatedTerminalDisplay implements Pseudoterminal {
  private readonly writeEmitter = new EventEmitter<string>();
  private readonly concealEmitter = new EventEmitter<void>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidConcealContent = this.concealEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private book?: PaginatedBook;
  private template: ResolvedTerminalTemplate = resolveBuiltinTemplate('buildLog');
  private lineWidth = 0;
  private lineCount = 3;
  private pendingOutput?: string;
  private opened = false;
  private readonly concealController: CamouflageConcealController;

  constructor(
    private readonly context: ExtensionContext,
    private readonly commandIds: PaginatedCommandIds
  ) {
    // 在构造体里创建：commandIds 参数属性先于本语句赋值。
    this.concealController = new CamouflageConcealController({
      render: () => this.renderOrIdle(),
      stop: () => commands.executeCommand(this.commandIds.stop),
      onConceal: () => this.concealEmitter.fire()
    });
  }

  bind(
    book: PaginatedBook,
    template: ResolvedTerminalTemplate,
    lineWidth: number,
    lineCount: number
  ): void {
    this.book = book;
    this.updateTemplate(template);
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
    this.concealController.reset();
  }

  updateSettings(
    template: ResolvedTerminalTemplate,
    lineWidth: number,
    lineCount: number
  ): void {
    this.updateTemplate(template);
    this.lineWidth = lineWidth;
    this.lineCount = lineCount;
  }

  unbind(): void {
    this.book = undefined;
    this.concealController.reset();
    this.write(formatResolvedTerminalIdleScreen(this.template));
  }

  getEffectiveLineWidth(): number {
    return computeResolvedEffectiveLineWidth(
      this.lineWidth,
      this.dimensions?.columns,
      this.template
    );
  }

  getLineCount(): number {
    return this.lineCount;
  }

  isRealContentMode(): boolean {
    return this.concealController.isRealContentMode();
  }

  open(): void {
    this.opened = true;
    this.writeEmitter.fire(this.pendingOutput || formatResolvedTerminalIdleScreen(this.template));
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
      next: () => this.executeRealContentCommand(this.commandIds.next),
      prev: () => this.executeRealContentCommand(this.commandIds.prev),
      jump: () => this.executeRealContentCommand(this.commandIds.jump),
      toggleDebug: () => this.toggleDebugContent(),
      quit: () => this.concealController.handleQuitKey(),
      viewImage: () => this.executeRealContentCommand(this.commandIds.viewImage),
      onNonQuitKey: () => this.concealController.clearPendingQuit()
    });
  }

  render(): void {
    if (!this.book) {
      return;
    }
    this.ensureTerminal();
    const effectiveWidth = this.getEffectiveLineWidth();
    const contentMode = this.concealController.mode;

    if (contentMode === 'debugTemplate') {
      this.write(
        formatResolvedDebugCamouflageScreen(
          this.template,
          effectiveWidth,
          this.lineCount,
          this.dimensions?.columns
        )
      );
      return;
    }

    const screen = this.book.getScreen(effectiveWidth, this.lineCount);
    const progressLabel =
      screen.images.length > 0 ? `${screen.progressLabel} · [图 i]` : screen.progressLabel;
    this.write(
      formatResolvedCamouflageScreen(
        this.template,
        screen.lines,
        progressLabel,
        this.dimensions?.columns
      )
    );
  }

  reveal(): void {
    this.ensureTerminal();
    if (this.book) {
      this.render();
    } else {
      this.write(formatResolvedTerminalIdleScreen(this.template));
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

  private executeRealContentCommand(command: string): void {
    if (this.isRealContentMode()) {
      commands.executeCommand(command);
    }
  }

  private updateTemplate(template: ResolvedTerminalTemplate): void {
    this.template = updateTerminalTemplate(
      this.template,
      template,
      this.terminal ? (title) => this.write(title) : undefined
    );
  }

  private renderOrIdle(): void {
    this.ensureTerminal();
    if (this.book) {
      this.render();
      return;
    }

    if (this.concealController.mode === 'debugTemplate') {
      this.write(
        formatResolvedDebugCamouflageScreen(
          this.template,
          this.getEffectiveLineWidth(),
          this.lineCount,
          this.dimensions?.columns
        )
      );
      return;
    }

    this.write(formatResolvedTerminalIdleScreen(this.template));
  }

  private ensureTerminal(): void {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }
    this.terminal = window.createTerminal({
      name: this.template.template.terminalName,
      pty: this
    });
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
