import { window, StatusBarAlignment, commands } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { app } from '../index';
import { StatusBarPriority } from '../config';
import { Commands } from '../commands';

export let importBarItem: StatusBarItem;

export function setupImportBarItem(context: ExtensionContext) {
  if (importBarItem) {
    return;
  }

  importBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.ImportBook
  );
  importBarItem.text = '$(add)';
  importBarItem.tooltip = '导入';
  importBarItem.command = Commands.ImportBook;
  importBarItem.show();

  context.subscriptions.push(importBarItem);
  commands.registerCommand(Commands.ImportBook, () => {
    app.bookList.addBook();
  });
}
