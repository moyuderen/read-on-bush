import { window, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { BookData } from '../Book';
import { getShowProgress, shouldShowStatusBarReading } from '../settings';
import { app } from '../index';
import { getBookMessageName } from '../privacy/PrivacyDisplayService';

export let progressBarItem: StatusBarItem;
export function setupProgressBarItem(context: ExtensionContext) {
  if (!progressBarItem) {
    progressBarItem = window.createStatusBarItem(
      StatusBarAlignment.Right,
      StatusBarPriority.Process
    );
    context.subscriptions.push(progressBarItem);
    progressBarItem.text = '';
    applyProgressVisibility();
  }
}

export function applyProgressVisibility() {
  if (!progressBarItem) {
    return;
  }

  if (!shouldShowStatusBarReading() || !getShowProgress()) {
    progressBarItem.hide();
    return;
  }

  progressBarItem.show();
}

export function updateProgress(cur: number, total: number, book: BookData) {
  const current = total > 0 ? Math.min(cur + 1, total) : 0;
  progressBarItem.text = `${current}/${total}`;
  const percent = total > 0 ? `${((current / total) * 100).toFixed(2)}%` : '0.00%';
  const bookName = app?.privacyDisplay.getBookMessageName(book) ?? getBookMessageName(book, 'normal');
  progressBarItem.tooltip = `${bookName}${percent}`;
}
