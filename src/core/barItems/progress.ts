import { window, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { BookData } from '../Book';

export let progressBarItem: StatusBarItem;
export function setupProgressBarItem(context: ExtensionContext) {
  if (!progressBarItem) {
    progressBarItem = window.createStatusBarItem(
      StatusBarAlignment.Right,
      StatusBarPriority.Process
    );
    context.subscriptions.push(progressBarItem);
    progressBarItem.text = '';
    progressBarItem.show();
  }
}

export function updateProgress(cur: number, total: number, book: BookData) {
  progressBarItem.text = `${cur || 0}/${total}`;
  const percent = `${((cur / total) * 100).toFixed(2)}%`;
  progressBarItem.tooltip = `《${book.name}》${percent}`;
}
