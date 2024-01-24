import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../commands';
import { app } from '../index';

export let nextLineBarItem: StatusBarItem;

export function setupNextLineBarItem(context: ExtensionContext) {
  if(!nextLineBarItem) {
    let commandPrev = Commands.NextLine;
    nextLineBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.NextLine);
    nextLineBarItem.command = commandPrev;
    context.subscriptions.push(nextLineBarItem);
    nextLineBarItem.text = `$(chevron-right)`;
    nextLineBarItem.tooltip = 'Next line';
    nextLineBarItem.show();
    commands.registerCommand(Commands.NextLine, () => {
      if(app.readingBook) {
        app.readingBook.nextLine();
      }
    });
  }
}