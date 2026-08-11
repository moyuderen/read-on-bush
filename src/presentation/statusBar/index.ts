import type { ExtensionContext } from 'vscode';
import type { BookFormat, TxtReadingPort } from '../../domain/books';
import { shouldShowStatusBarReading } from '../../config/settings';
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

export function setupBars(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  setupModeBarItem(context);
  setupContentBarItem(context);
  setupPreLineBarItem(context, reading);
  setupNextLineBarItem(context, reading);
  setupJumpLineBarItem(context, reading);
  setupStartBarItem(context, reading);
  setupStopBarItem(context, reading);
  setupTerminalCamouflageBarItem(context);
  setupProgressBarItem(context);
}

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

export function updateTxtStatusBarVisibility(
  activeFormat: BookFormat | undefined,
  isReading: boolean
): void {
  const showReadingControls = activeFormat === 'txt' && shouldShowStatusBarReading();

  if (!showReadingControls) {
    [
      startBarItem,
      stopBarItem,
      prevLineBarItem,
      nextLineBarItem,
      jumpLineBarItem,
      contentBarItem,
      progressBarItem
    ].forEach((item) => item?.hide());
    if (activeFormat === undefined) {
      startBarItem?.show();
    }
    return;
  }

  applyReadingControlVisibility(isReading);
}
