import { commands, window } from 'vscode';
import type { ExtensionContext } from 'vscode';
import type { ApplicationContext } from './ApplicationContext';
import { Commands } from '../config/commands';
import message from '../utils/message';
import { getAutoRefreshBookList } from '../config/settings';

export function refreshBookList(app: ApplicationContext, options: { silent?: boolean } = {}) {

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

export function setupAutoRefreshBookList(context: ExtensionContext, app: ApplicationContext) {
  context.subscriptions.push(
    window.onDidChangeWindowState((state) => {
      if (state.focused && getAutoRefreshBookList()) {
        refreshBookList(app, { silent: true });
      }
    })
  );
}

export function setupViewTitleImport(context: ExtensionContext, app: ApplicationContext) {
  context.subscriptions.push(
    commands.registerCommand(Commands.ImportBook, () => {
      app.bookList.addBook();
    }),
    commands.registerCommand(Commands.ImportBookDirectory, () => {
      app.bookList.addBookDirectory();
    }),
    commands.registerCommand(Commands.RefreshBookList, () => {
      refreshBookList(app);
    })
  );
}
