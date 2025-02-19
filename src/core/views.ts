import { commands } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { app } from './index';
import { Commands } from './Commands';
import message from '../utils/message';

export function setupViewTitleImport(context: ExtensionContext) {
  commands.registerCommand(Commands.ImportBook, () => {
    app.bookList.addBook();
  });

  commands.registerCommand(Commands.RefreshBookList, () => {
    try {
      // 不同窗口，通过本地存储拿到books
      app.bookList.getBooks();
      app.bookList.updateBookTreeProvider();
      message('Book list refreshed');
    } catch {
      message.error('Failed to refresh book list');
    }
  });
}
