import { commands, window } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { ApplicationContext } from './ApplicationContext';
import { ConfigurationCoordinator } from './ConfigurationCoordinator';
import { setupStorage } from '../utils/storage';
import { setupBars, updateTxtStatusBarVisibility } from '../presentation/statusBar';
import { CustomWhenClauseContext } from '../config/commands';
import { setupAutoRefreshBookList, setupViewTitleImport } from './viewCommands';
import { setupCustomTemplateEditor } from '../presentation/readerEditors';
import { readerViewId } from '../presentation/readerSurfaces';

export function setup(context: ExtensionContext) {
  setupStorage(context);

  const app = new ApplicationContext(context);

  context.subscriptions.push(
    app.readerSurface,
    app.readerViewPanel,
    app.terminalSurface,
    window.registerWebviewViewProvider(readerViewId, app.readerViewPanel, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  setupBars(context, app.readingSession);
  context.subscriptions.push(
    app.readingSession.onDidChangeFormat((format) => {
      void commands.executeCommand(
        'setContext',
        CustomWhenClauseContext.IsTxtReading,
        format === 'txt'
      );
      updateTxtStatusBarVisibility(format, app.readingSession.currentTxtState?.isReading ?? false);
    })
  );
  setupCustomTemplateEditor(context);
  setupViewTitleImport(context, app);
  setupAutoRefreshBookList(context, app);
  new ConfigurationCoordinator(context, app);

  app.displayManager.showIdleHint();

  return app;
}
