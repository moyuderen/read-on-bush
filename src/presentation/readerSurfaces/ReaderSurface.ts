import type { Disposable, Event } from 'vscode';
import type { CamouflagePreviewLine } from '../reader/rendering';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { TerminalCamouflageContentMode } from '../reader/rendering';

/**
 * 显示载体的尺寸（终端列数 / 行数），与 TerminalDimensions 结构一致。
 */
export type SurfaceDimensions = { columns: number; rows: number };

export type ReaderSurfaceFrame = {
  screen: string;
  lines: CamouflagePreviewLine[];
  template: ResolvedTerminalTemplate;
  mode: TerminalCamouflageContentMode;
};

/**
 * 阅读内容的显示载体抽象。两种实现：
 * - ReaderViewSurface：Webview 面板（readerPanel 模式）
 * - TerminalSurface：集成终端（terminal 模式）
 *
 * 显示类（PaginatedReaderDisplay / TxtCamouflageDisplay）只依赖此接口，
 * 由 SurfaceRouter 在运行时根据配置切换具体实现。
 */
export interface ReaderSurface extends Disposable {
  readonly onDidResize: Event<SurfaceDimensions>;
  publishFrame(frame: ReaderSurfaceFrame): void;
  publishIdle(template: ResolvedTerminalTemplate): void;
  publishHint(text: string): void;
  clear(): void;

  setInputHandler(handler: ((data: string) => void) | undefined): void;

  focus(): void;
}
