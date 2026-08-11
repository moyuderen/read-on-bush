import { Commands } from '../../config/commands';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import { CamouflageDisplayBase } from './CamouflageDisplayBase';
import type { CamouflageInputHandlers } from '../readerControls';
import { createReaderSurfaceFrame, type ReaderSurface } from '../readerSurfaces';
import {
  computeResolvedEffectiveLineWidth,
  formatResolvedCamouflageScreen,
  formatResolvedDebugCamouflageScreen,
  resolveBuiltinTemplate,
  updateTerminalTemplate
} from './rendering';

/**
 * 分页阅读的伪装终端（epub / pdf 共用）。显示输出由 ReaderViewSurface 负责，
 * 本类继续负责分页模型、模板、隐私模式和输入到命令的映射。
 */

export type PaginatedScreen = {
  lines: string[];
  images: readonly unknown[];
};

export interface PaginatedBook {
  getScreen(lineWidth: number, lineCount: number): PaginatedScreen;
  getProgressLabel(showChapterTitle?: boolean): string;
}

export interface PaginatedReaderBook extends PaginatedBook {
  next(lineWidth: number, lineCount: number): boolean;
  prev(lineWidth: number, lineCount: number): boolean;
}

export type ReaderDisplaySettings = {
  template: ResolvedTerminalTemplate;
  lineWidth: number;
  lineCount: number;
  showChapterTitle: boolean;
};

export type PaginatedCommandIds = {
  next: string;
  prev: string;
  jump: string;
  stop: string;
  viewImage: string;
};

export class PaginatedReaderDisplay extends CamouflageDisplayBase {
  private book?: PaginatedBook;
  private template: ResolvedTerminalTemplate = resolveBuiltinTemplate('buildLog');
  private lineWidth = 0;
  private lineCount = 3;
  private showChapterTitle = true;
  private readonly commandIds: PaginatedCommandIds;

  constructor(commandIds: PaginatedCommandIds, readerView: ReaderSurface) {
    super(undefined, readerView, commandIds.stop);
    this.commandIds = commandIds;
  }

  bind(book: PaginatedBook, settings: ReaderDisplaySettings): void {
    this.book = book;
    this.applySettings(settings);
    this.concealController.reset();
  }

  updateSettings(settings: ReaderDisplaySettings): void {
    this.applySettings(settings);
  }

  unbind(): void {
    this.book = undefined;
    this.concealController.reset();
    this.opened = false;
    this.readerView.setInputHandler(undefined);
    this.readerView.publishIdle(this.template);
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

  reveal(): void {
    this.open();
  }

  render(): void {
    this.renderOrIdle();
  }

  protected getInputHandlers(): CamouflageInputHandlers {
    return {
      next: () => this.executeRealContentCommand(this.commandIds.next),
      prev: () => this.executeRealContentCommand(this.commandIds.prev),
      jump: () => this.executeRealContentCommand(this.commandIds.jump),
      search: () => this.executeRealContentCommand(Commands.SearchCurrentBook),
      toggleDebug: () => this.toggleDebugContent(),
      quit: () => this.concealController.handleQuitKey(),
      viewImage: () => this.executeRealContentCommand(this.commandIds.viewImage),
      onNonQuitKey: () => this.concealController.clearPendingQuit()
    };
  }

  protected clearState(): void {
    this.book = undefined;
  }


  private applySettings(settings: ReaderDisplaySettings): void {
    this.updateTemplate(settings.template);
    this.lineWidth = settings.lineWidth;
    this.lineCount = settings.lineCount;
    this.showChapterTitle = settings.showChapterTitle;
  }

  private updateTemplate(template: ResolvedTerminalTemplate): void {
    this.template = updateTerminalTemplate(this.template, template);
  }

  protected renderOrIdle(): void {
    if (!this.opened) {
      return;
    }

    if (!this.book) {
      this.readerView.publishIdle(this.template);
      return;
    }

    if (this.concealController.mode === 'debugTemplate') {
      const screen = formatResolvedDebugCamouflageScreen(
        this.template,
        this.getEffectiveLineWidth(),
        this.lineCount,
        this.dimensions?.columns
      );
      this.readerView.publishFrame(
        createReaderSurfaceFrame(screen, this.template, this.concealController.mode)
      );
      return;
    }

    const screen = this.book.getScreen(this.getEffectiveLineWidth(), this.lineCount);
    const progressLabel = this.book.getProgressLabel(this.showChapterTitle);
    const visibleProgressLabel =
      screen.images.length > 0 ? `${progressLabel} · [图 i]` : progressLabel;
    const output = formatResolvedCamouflageScreen(
      this.template,
      screen.lines,
      visibleProgressLabel,
      this.dimensions?.columns
    );
    this.readerView.publishFrame(
      createReaderSurfaceFrame(output, this.template, this.concealController.mode)
    );
  }
}
