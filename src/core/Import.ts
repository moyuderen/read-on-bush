import { window, StatusBarAlignment, commands, type StatusBarItem, type ExtensionContext} from 'vscode';
import { StatusBarPriority } from './config';

let importStatusBarItem: StatusBarItem;
const command = "readOnBush.import";
importStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.ImportBook);
importStatusBarItem.text = '$(add)';
importStatusBarItem.tooltip = '导入';
importStatusBarItem.command = command;
importStatusBarItem.show();

export function importFile(context: ExtensionContext, cb: (...args: any[]) => any) {
  context.subscriptions.push(importStatusBarItem);

  commands.registerCommand(command, cb);
}
