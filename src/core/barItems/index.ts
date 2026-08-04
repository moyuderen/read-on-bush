import type { ExtensionContext } from 'vscode';
import type { BookFormat } from '../Book';
import { shouldShowStatusBarReading } from '../settings';
import { app } from '../index';
// import { setupImportBarItem } from "./import";
import { readingModeBarItem, codingModeBarItem, setupModeBarItem } from './mode';
import { contentBarItem, setupContentBarItem } from './content';
import { prevLineBarItem, setupPreLineBarItem } from './prevLine';
import { nextLineBarItem, setupNextLineBarItem } from './nextLine';
import { jumpLineBarItem, setupJumpLineBarItem } from './jumpLine';
import { startBarItem, setupStartBarItem } from './start';
import { stopBarItem, setupStopBarItem } from './stop';
import { progressBarItem, setupProgressBarItem } from './progress';
import { setupTerminalCamouflageBarItem } from './terminalCamouflage';

export { readingModeBarItem, codingModeBarItem };

export function setupBars(context: ExtensionContext) {
  // setupImportBarItem(context);
  setupModeBarItem(context);
  setupContentBarItem(context);
  setupPreLineBarItem(context);
  setupNextLineBarItem(context);
  setupJumpLineBarItem(context);
  setupStartBarItem(context);
  setupStopBarItem(context);
  setupTerminalCamouflageBarItem(context);
  setupProgressBarItem(context);
}

/**
 * 切换 TXT 阅读导航控件（start/stop/prev/next/jump）的可见性。
 *
 * start 与 stop 互斥；阅读时显示 stop/prev/next/jump，未阅读时只显示 start。
 */
export function applyReadingControlVisibility(isReading: boolean): void {
  if (isReading) {
    startBarItem?.hide();
    stopBarItem?.show();
    prevLineBarItem?.show();
    nextLineBarItem?.show();
    jumpLineBarItem?.show();
  } else {
    startBarItem?.show();
    stopBarItem?.hide();
    prevLineBarItem?.hide();
    nextLineBarItem?.hide();
    jumpLineBarItem?.hide();
  }
}

/**
 * 根据当前阅读格式和 displayTarget 刷新 TXT 阅读操作按钮的可见性。
 *
 * 仅管理 TXT 阅读导航控件（start/stop/prev/next/jump/content/progress）。
 * Terminal 切换按钮和 Reading/Coding 模式按钮始终展示，不受此函数控制。
 *
 * - TXT + statusBar：根据 start/stop 状态恢复按钮。
 * - TXT + terminalCamouflage / EPUB / PDF：隐藏全部阅读操作。
 * - 未阅读：不改变（保持默认）。
 *
 * 应在 ReadingSessionService 打开/关闭书籍、以及 displayTarget 配置变更时调用。
 */
export function updateTxtStatusBarVisibility(activeFormat: BookFormat | undefined): void {
  const showReadingControls = activeFormat === 'txt' && shouldShowStatusBarReading();

  if (!showReadingControls) {
    // 非 statusBar 阅读场景（terminal/EPUB/PDF/关闭书籍）：隐藏全部阅读控件
    [startBarItem, stopBarItem, prevLineBarItem, nextLineBarItem, jumpLineBarItem, contentBarItem, progressBarItem]
      .forEach((item) => item?.hide());
    // 关闭书籍时恢复初始状态：start 可见
    if (activeFormat === undefined) {
      startBarItem?.show();
    }
    return;
  }

  // TXT + statusBar：根据当前阅读状态恢复控件
  applyReadingControlVisibility(app.readingBook?.isReading ?? false);
}
