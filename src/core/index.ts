import { workspace } from 'vscode';
import { type ExtensionContext } from 'vscode';
import { ReadBook } from './ReadBook';
import { setupStorage } from '../utils/storage';
import { setupBars } from './barItems';
import { applyReadingMode } from './barItems/mode';
import { setupAutoRefreshBookList, setupViewTitleImport } from './views';
import {
  affectsReadOnBushConfiguration,
  affectsSetting,
  getDefaultReadingMode,
  type ReadOnBushSettingKey
} from './settings';
import message from '../utils/message';

export let app: ReadBook;

const displayRefreshSettingKeys: ReadOnBushSettingKey[] = [
  'statusBarPrefix',
  'showProgress',
  'displayTarget',
  'terminalCamouflageLineWidth',
  'terminalCamouflageLineCount',
  'terminalCamouflageStyle'
];

function setupConfigurationChangeHandlers(context: ExtensionContext) {
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (!affectsReadOnBushConfiguration(event)) {
        return;
      }

      const defaultReadingModeChanged = affectsSetting(event, 'defaultReadingMode');
      const displayRefreshSettingChanged = displayRefreshSettingKeys.some((key) =>
        affectsSetting(event, key)
      );
      const lineWidthChanged = affectsSetting(event, 'lineWidth');
      const bookListGroupByChanged = affectsSetting(event, 'bookListGroupBy');

      if (defaultReadingModeChanged) {
        applyReadingMode(getDefaultReadingMode());
      }

      if (displayRefreshSettingChanged) {
        app.displayManager.refresh(app.readingBook && app.readingBook.getDisplayState());
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
