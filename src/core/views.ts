import { commands, window } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { app } from './index';
import { Commands } from './Commands';
import message from '../utils/message';
import { getAutoRefreshBookList } from './settings';

export function refreshBookList(options: { silent?: boolean } = {}) {
  if (!app || !app.bookList) {
    if (!options.silent) {
      message.error('Failed to refresh book list');
    }
    return;
  }

  try {
    // 不同窗口，通过本地存储拿到books
    app.bookList.getBooks();
    app.bookList.updateBookTreeProvider();

    if (!options.silent) {
      message('Book list refreshed');
    }
  } catch {
    if (!options.silent) {
      message.error('Failed to refresh book list');
    }
  }
}

export function setupAutoRefreshBookList(context: ExtensionContext) {
  context.subscriptions.push(
    window.onDidChangeWindowState((state) => {
      if (state.focused && getAutoRefreshBookList()) {
        refreshBookList({ silent: true });
      }
    })
  );
}

export function setupViewTitleImport(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(Commands.ImportBook, () => {
      app.bookList.addBook();
    }),
    commands.registerCommand(Commands.RefreshBookList, () => {
      refreshBookList();
    })
  );
}
