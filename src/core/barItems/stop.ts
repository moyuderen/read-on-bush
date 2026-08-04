import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../Commands';
import { applyReadingControlVisibility } from './index';
import { contentBarItem } from './content';
import { readingModeBarItem, codingModeBarItem } from './mode';
import { progressBarItem } from './progress';
import { app } from '../index';

export let stopBarItem: StatusBarItem;
export function setupStopBarItem(context: ExtensionContext) {
  if (stopBarItem) {
    return;
  }
  stopBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Stop);
  stopBarItem.command = Commands.Stop;
  context.subscriptions.push(stopBarItem);
  stopBarItem.text = `$(debug-stop)`;
  stopBarItem.tooltip = 'Stop';
  stopBarItem.show();

  commands.registerCommand(Commands.Stop, () => {
    applyReadingControlVisibility(false);
    contentBarItem.hide();
    progressBarItem.hide();
    codingModeBarItem.show();
    readingModeBarItem.hide();
    commands.executeCommand(Commands.SwitchCodingMode);

    app.readingBook && app.readingBook.pause();
  });
}
