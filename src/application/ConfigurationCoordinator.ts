import { workspace } from 'vscode';
import type { ConfigurationChangeEvent, ExtensionContext } from 'vscode';
import { ApplicationContext } from './ApplicationContext';
import { applyReadingMode } from '../presentation/statusBar/mode';
import { updateTxtStatusBarVisibility } from '../presentation/statusBar';
import message from '../utils/message';
import {
  affectsReadOnBushConfiguration,
  affectsSetting,
  getDefaultReadingMode,
  getTerminalCamouflageStyle,
  type ReadOnBushSettingKey
} from '../config/settings';

const displayRefreshSettingKeys: readonly ReadOnBushSettingKey[] = [
  'statusBarPrefix',
  'showProgress',
  'displayTarget',
  'terminalCamouflageLineWidth',
  'terminalCamouflageLineCount',
  'terminalCamouflageStyle'
];

const readingSessionRefreshSettingKeys: readonly ReadOnBushSettingKey[] = [
  'showChapterTitle',
  'terminalCamouflageLineWidth',
  'terminalCamouflageLineCount',
  'terminalCamouflageStyle'
];

export class ConfigurationCoordinator {
  constructor(
    context: ExtensionContext,
    private readonly app: ApplicationContext
  ) {
    context.subscriptions.push(
      workspace.onDidChangeConfiguration((event) => this.handleChange(event))
    );
  }

  private handleChange(event: ConfigurationChangeEvent): void {
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
    const displayRefreshChanged =
      this.affectsAny(event, displayRefreshSettingKeys) || customTemplateActive;
    const readingSessionRefreshChanged =
      this.affectsAny(event, readingSessionRefreshSettingKeys) || customTemplateActive;

    if (defaultReadingModeChanged) {
      applyReadingMode(getDefaultReadingMode());
    }

    if (affectsSetting(event, 'camouflageSurface')) {
      this.app.swapCamouflageSurface();
    }

    if (displayRefreshChanged) {
      this.app.displayManager.refresh(this.app.readingSession.currentTxtState);
      updateTxtStatusBarVisibility(
        this.app.readingSession.current?.format,
        this.app.readingSession.currentTxtState?.isReading ?? false
      );
    }

    if (readingSessionRefreshChanged) {
      this.app.readingSession.refreshSettings();
    }

    if (affectsSetting(event, 'lineWidth')) {
      message('Line width will apply the next time a book is opened');
    }

    if (affectsSetting(event, 'bookListGroupBy')) {
      this.app.bookList.updateBookTreeProvider();
    }
  }

  private affectsAny(
    event: ConfigurationChangeEvent,
    keys: readonly ReadOnBushSettingKey[]
  ): boolean {
    return keys.some((key) => affectsSetting(event, key));
  }
}
