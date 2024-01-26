import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../commands';
import { app } from '../index';
import message from '../../utils/message';

export let prevLineBarItem: StatusBarItem;

export function setupPreLineBarItem(context: ExtensionContext) {
  if(!prevLineBarItem) {
    prevLineBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.PrevLine);
    prevLineBarItem.command = Commands.PrevLine;
    context.subscriptions.push(prevLineBarItem);
    prevLineBarItem.text = `$(chevron-left)`;
    prevLineBarItem.tooltip = 'Prev line';
    prevLineBarItem.show();
    commands.registerCommand(Commands.PrevLine, () => {
      if(!app.readingBook) {
        message.error('请选择要读的书籍！');
        return;
      }
      app.readingBook.prevLine();
    });
  }
}