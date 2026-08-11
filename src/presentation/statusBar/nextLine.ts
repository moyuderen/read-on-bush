import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../../config/constants';
import { Commands } from '../../config/commands';
import type { TxtReadingPort } from '../../domain/books';
import message from '../../utils/message';

export let nextLineBarItem: StatusBarItem;

export function setupNextLineBarItem(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  if (nextLineBarItem) {
    return;
  }

  nextLineBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.NextLine
  );
  nextLineBarItem.command = Commands.NextLine;
  context.subscriptions.push(nextLineBarItem);
  nextLineBarItem.text = `$(chevron-right)`;
  nextLineBarItem.tooltip = 'Next line';
  nextLineBarItem.show();
  context.subscriptions.push(
    commands.registerCommand(Commands.NextLine, () => {
      if (!reading.currentTxtState) {
        message.warn('请选择要读的书籍！');
        return;
      }
      void reading.nextTxt();
    })
  );
}
