import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../commands';
import { app } from '../index';
import message from '../../utils/message';

export let jumpLineBarItem: StatusBarItem;

export function setupJumpLineBarItem(context: ExtensionContext) {
  if(!jumpLineBarItem) {
    jumpLineBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.NextLine);
    jumpLineBarItem.command = Commands.JumpLine;
    context.subscriptions.push(jumpLineBarItem);
    jumpLineBarItem.text = `$(debug-step-over)`;
    jumpLineBarItem.tooltip = 'Jump line';
    jumpLineBarItem.show();
    commands.registerCommand(Commands.JumpLine, async () => {
      if(!app.readingBook) {
        message.warn('请选择要读的书籍！');
        return;
      }
      const value = await window.showInputBox({
        title: '跳转到指定行',
        placeHolder: `请输入页码 (${0}-${app.readingBook.contents.length})`, 
        validateInput: (value: string) => {
          if(value === '') {
            return '请输入正确页码';
          }

          if(isNaN(+value)) {
            return '请输入正确页码';
          }

          if(!/^[+]{0,1}(\d+)$/.test(value)) {
            return '请输入正确页码';
          }

          if(+value < 0 || +value > app.readingBook.contents.length) {
            return '请输入正确范围的页码';
          }

          return; 
        }
      });
      if(!value) {
        return;
      }
      app.readingBook.jumpLine(Number(value));
    });
  }
}