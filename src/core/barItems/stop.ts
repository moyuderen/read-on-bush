import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../commands';
import { startBarItem } from './start';
import { contentBarItem } from './content';
import { prevLineBarItem } from './prevLine';
import { nextLineBarItem } from './nextLine';
import { readingModeBarItem, codingModeBarItem } from './mode';
import { progressBarItem } from './progress';
import { app } from '../index';

export let  stopBarItem: StatusBarItem;
export function setupStopBarItem(context: ExtensionContext) {
  if(stopBarItem) {
    return; 
  }
  stopBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Stop);
  stopBarItem.command = Commands.Stop;
  context.subscriptions.push(stopBarItem);
  stopBarItem.text = `$(debug-stop)`;
  stopBarItem.tooltip = 'Stop';
  stopBarItem.show();

  commands.registerCommand(Commands.Stop, () => {
    startBarItem.show();
    stopBarItem.hide();
    contentBarItem.hide();
    prevLineBarItem.hide();
    nextLineBarItem.hide();
    progressBarItem.hide();
    codingModeBarItem.show();
    readingModeBarItem.hide();
    commands.executeCommand(Commands.SwitchCodingMode);

    app.readingBook.pause();
  });
}
