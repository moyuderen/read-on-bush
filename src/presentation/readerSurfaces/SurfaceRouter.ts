import { EventEmitter } from 'vscode';
import type { Disposable } from 'vscode';
import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { ReaderSurface, ReaderSurfaceFrame, SurfaceDimensions } from './ReaderSurface';
import type { CamouflageSurface } from '../../config/settings';

/**
 * 热切换代理：持有终端和面板两个实现，把所有调用转发给当前活跃的那一个。
 *
 * 切换载体时只需 swapTo()：清理旧载体 → 切换指针 → 显示类下次 render 自动走向新载体。
 * 显示类完全不感知底层是终端还是面板。
 */
export class SurfaceRouter implements ReaderSurface {
  private readonly resizeEmitter = new EventEmitter<SurfaceDimensions>();
  private readonly disposables: Disposable[] = [];
  private readonly surfaces: Record<CamouflageSurface, ReaderSurface>;
  private currentId: CamouflageSurface;

  constructor(terminal: ReaderSurface, panel: ReaderSurface, initial: CamouflageSurface) {
    this.surfaces = { terminal, readerPanel: panel };
    this.currentId = initial;

    // 仅转发当前活跃载体的 resize 事件，避免非活跃载体的尺寸覆盖活跃载体的尺寸
    for (const [id, surface] of Object.entries(this.surfaces) as [
      CamouflageSurface,
      ReaderSurface
    ][]) {
      this.disposables.push(
        surface.onDidResize((dimensions) => {
          if (this.currentId === id) {
            this.resizeEmitter.fire(dimensions);
          }
        })
      );
    }
  }

  private get current(): ReaderSurface {
    return this.surfaces[this.currentId];
  }

  readonly onDidResize = this.resizeEmitter.event;

  /** 热切换：清理旧载体，切换指针到新载体。调用方需随后触发 render。 */
  swapTo(surface: CamouflageSurface): void {
    const target = this.surfaces[surface];
    if (target === this.current) {
      return;
    }
    this.current.setInputHandler(undefined);
    this.current.clear();
    this.currentId = surface;
  }

  publishFrame(frame: ReaderSurfaceFrame): void {
    this.current.publishFrame(frame);
  }

  publishIdle(template: ResolvedTerminalTemplate): void {
    this.current.publishIdle(template);
  }

  publishHint(text: string): void {
    this.current.publishHint(text);
  }

  clear(): void {
    this.current.clear();
  }

  setInputHandler(handler: ((data: string) => void) | undefined): void {
    this.current.setInputHandler(handler);
  }

  focus(): void {
    this.current.focus();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.resizeEmitter.dispose();
  }
}
