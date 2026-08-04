import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../Commands';
import { applyReadingControlVisibility } from './index';
import { app } from '../index';

export let startBarItem: StatusBarItem;
export function setupStartBarItem(context: ExtensionContext) {
  if (startBarItem) {
    return;
  }

  startBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Start);
  startBarItem.command = Commands.Start;
  context.subscriptions.push(startBarItem);
  startBarItem.text = `$(run)`;
  startBarItem.tooltip = 'Start';

  commands.registerCommand(Commands.Start, () => {
    applyReadingControlVisibility(true);
    app.readingBook && app.readingBook.start();
  });
}
