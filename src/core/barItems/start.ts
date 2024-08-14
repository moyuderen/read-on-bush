import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../Commands';
import { stopBarItem } from './stop';
import { contentBarItem } from './content';
import { prevLineBarItem } from './prevLine';
import { nextLineBarItem } from './nextLine';
import { jumpLineBarItem } from './jumpLine';
import { progressBarItem } from './progress';
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
    startBarItem.hide();
    stopBarItem.show();
    contentBarItem.show();
    prevLineBarItem.show();
    nextLineBarItem.show();
    jumpLineBarItem.show();
    progressBarItem.show();

    app.readingBook && app.readingBook.start();
  });
}
