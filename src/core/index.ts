import { workspace } from 'vscode';
import { type ExtensionContext } from 'vscode';
import { ReadBook } from './ReadBook';
import { setupStorage } from '../utils/storage';
import { setupBars } from './barItems';
import { applyReadingMode } from './barItems/mode';
import { refreshContentBarItem } from './barItems/content';
import { applyProgressVisibility } from './barItems/progress';
import { setupAutoRefreshBookList, setupViewTitleImport } from './views';
import {
  affectsReadOnBushConfiguration,
  affectsSetting,
  getDefaultReadingMode
} from './settings';
import message from '../utils/message';

export let app: ReadBook;

function setupConfigurationChangeHandlers(context: ExtensionContext) {
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (!affectsReadOnBushConfiguration(event)) {
        return;
      }

      const defaultReadingModeChanged = affectsSetting(event, 'defaultReadingMode');
      const statusBarPrefixChanged = affectsSetting(event, 'statusBarPrefix');
      const showProgressChanged = affectsSetting(event, 'showProgress');
      const lineWidthChanged = affectsSetting(event, 'lineWidth');
      const bookListGroupByChanged = affectsSetting(event, 'bookListGroupBy');

      if (defaultReadingModeChanged) {
        applyReadingMode(getDefaultReadingMode());
      }

      if (statusBarPrefixChanged) {
        refreshContentBarItem();
      }

      if (showProgressChanged) {
        applyProgressVisibility();
      }

      if (lineWidthChanged) {
        message('Line width will apply the next time a book is opened');
      }

      if (bookListGroupByChanged) {
        app.bookList.updateBookTreeProvider();
      }
    })
  );
}

export function setup(context: ExtensionContext) {
  setupStorage(context);
  setupBars(context);

  app = new ReadBook(context);

  setupViewTitleImport(context);
  setupAutoRefreshBookList(context);
  setupConfigurationChangeHandlers(context);

  return app;
}
