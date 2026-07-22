import { window, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { BookData } from '../Book';
import { getShowProgress } from '../settings';

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

  if (getShowProgress()) {
    progressBarItem.show();
    return;
  }

  progressBarItem.hide();
}

export function updateProgress(cur: number, total: number, book: BookData) {
  progressBarItem.text = `${cur || 0}/${total}`;
  const percent = total > 0 ? `${((cur / total) * 100).toFixed(2)}%` : '0.00%';
  progressBarItem.tooltip = `《${book.name}》${percent}`;
}
