import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../../config/constants';
import { Commands } from '../../config/commands';
import type { TxtReadingPort } from '../../domain/books';
import message from '../../utils/message';

export let prevLineBarItem: StatusBarItem;

export function setupPreLineBarItem(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  if (prevLineBarItem) {
    return;
  }

  prevLineBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.PrevLine
  );
  prevLineBarItem.command = Commands.PrevLine;
  context.subscriptions.push(prevLineBarItem);
  prevLineBarItem.text = `$(chevron-left)`;
  prevLineBarItem.tooltip = 'Prev line';
  prevLineBarItem.show();
  context.subscriptions.push(
    commands.registerCommand(Commands.PrevLine, () => {
      if (!reading.currentTxtState) {
        message.warn('请选择要读的书籍！');
        return;
      }
      void reading.previousTxt();
    })
  );
}
