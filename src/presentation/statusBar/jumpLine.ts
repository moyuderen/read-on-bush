import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../../config/constants';
import { Commands } from '../../config/commands';
import type { TxtReadingPort } from '../../domain/books';
import message from '../../utils/message';

export let jumpLineBarItem: StatusBarItem;

export function setupJumpLineBarItem(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  if (jumpLineBarItem) {
    return;
  }

  jumpLineBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.NextLine
  );
  jumpLineBarItem.command = Commands.JumpLine;
  context.subscriptions.push(jumpLineBarItem);
  jumpLineBarItem.text = `$(debug-step-over)`;
  jumpLineBarItem.tooltip = 'Jump line';
  jumpLineBarItem.show();
  context.subscriptions.push(
    commands.registerCommand(Commands.JumpLine, async () => {
      const pageCount = reading.currentTxtPageCount;
      if (pageCount === 0) {
        message.warn('请选择要读的书籍！');
        return;
      }

      const value = await window.showInputBox({
        title: '跳转到指定行',
        placeHolder: `请输入页码 (1-${pageCount})`,
        validateInput: (input: string) => {
          if (input === '' || Number.isNaN(Number(input)) || !/^[+]{0,1}(\d+)$/.test(input)) {
            return '请输入正确页码';
          }
          if (Number(input) < 1 || Number(input) > pageCount) {
            return '请输入正确范围的页码';
          }
          return;
        }
      });
      if (value) {
        void reading.jumpTxt(Number(value) - 1);
      }
    })
  );
}
