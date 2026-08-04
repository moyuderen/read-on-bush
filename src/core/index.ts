import { workspace } from 'vscode';
import { type ExtensionContext } from 'vscode';
import { ReadBook } from './ReadBook';
import { setupStorage } from '../utils/storage';
import { setupBars, updateTxtStatusBarVisibility } from './barItems';
import { applyReadingMode } from './barItems/mode';
import { setupAutoRefreshBookList, setupViewTitleImport } from './views';
import {
  affectsReadOnBushConfiguration,
  affectsSetting,
  getDefaultReadingMode,
  getTerminalCamouflageStyle,
  type ReadOnBushSettingKey
} from './settings';
import message from '../utils/message';
import { setupCustomTemplateEditor } from './display/terminalCamouflageTemplateEditor';

export let app: ReadBook;

const displayRefreshSettingKeys: ReadOnBushSettingKey[] = [
  'statusBarPrefix',
  'showProgress',
  'displayTarget',
  'terminalCamouflageLineWidth',
  'terminalCamouflageLineCount',
  'terminalCamouflageStyle'
];
const readingSessionRefreshSettingKeys: ReadOnBushSettingKey[] = [
  'showChapterTitle',
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
      const customTemplateChanged = affectsSetting(
        event,
        'terminalCamouflageCustomTemplate'
      );
      const customTemplateActive =
        customTemplateChanged && getTerminalCamouflageStyle() === 'custom';
      const displayRefreshSettingChanged =
        displayRefreshSettingKeys.some((key) => affectsSetting(event, key)) ||
        customTemplateActive;
      const readingSessionRefreshSettingChanged =
        readingSessionRefreshSettingKeys.some((key) => affectsSetting(event, key)) ||
        customTemplateActive;
      const lineWidthChanged = affectsSetting(event, 'lineWidth');
      const bookListGroupByChanged = affectsSetting(event, 'bookListGroupBy');

      if (defaultReadingModeChanged) {
        applyReadingMode(getDefaultReadingMode());
      }

      if (displayRefreshSettingChanged) {
        app.displayManager.refresh(app.readingBook && app.readingBook.getDisplayState());
        updateTxtStatusBarVisibility(app.readingSession.current?.format);
      }

      if (readingSessionRefreshSettingChanged) {
        app.readingSession.refreshSettings();
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
  setupCustomTemplateEditor(context);

  app = new ReadBook(context);

  setupViewTitleImport(context);
  setupAutoRefreshBookList(context);
  setupConfigurationChangeHandlers(context);

  return app;
}
