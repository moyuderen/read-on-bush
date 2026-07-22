import { workspace } from 'vscode';
import type { ConfigurationChangeEvent } from 'vscode';
import { AppName, LineWidth } from './config';

export type BookListGroupBy = 'none' | 'category' | 'directory';

export type ReadOnBushSettings = {
  lineWidth: number;
  defaultReadingMode: boolean;
  autoRefreshBookList: boolean;
  statusBarPrefix: string;
  showProgress: boolean;
  bookListGroupBy: BookListGroupBy;
};

export const defaultSettings: ReadOnBushSettings = {
  lineWidth: LineWidth.Default,
  defaultReadingMode: true,
  autoRefreshBookList: false,
  statusBarPrefix: '',
  showProgress: true,
  bookListGroupBy: 'none'
};

export type ReadOnBushSettingKey = keyof ReadOnBushSettings;

function normalizeLineWidth(lineWidth: number): number {
  if (!Number.isFinite(lineWidth)) {
    return defaultSettings.lineWidth;
  }

  return Math.min(Math.max(Math.floor(lineWidth), LineWidth.Min), LineWidth.Max);
}

function normalizeBookListGroupBy(groupBy: string): BookListGroupBy {
  if (groupBy === 'category' || groupBy === 'directory') {
    return groupBy;
  }

  return defaultSettings.bookListGroupBy;
}

function getConfigurationValue<T extends ReadOnBushSettingKey>(key: T): ReadOnBushSettings[T] {
  return workspace.getConfiguration(AppName).get(key, defaultSettings[key]);
}

export function getLineWidth(): number {
  return normalizeLineWidth(getConfigurationValue('lineWidth'));
}

export function getDefaultReadingMode(): boolean {
  return getConfigurationValue('defaultReadingMode');
}

export function getAutoRefreshBookList(): boolean {
  return getConfigurationValue('autoRefreshBookList');
}

export function getStatusBarPrefix(): string {
  return getConfigurationValue('statusBarPrefix');
}

export function getShowProgress(): boolean {
  return getConfigurationValue('showProgress');
}

export function getBookListGroupBy(): BookListGroupBy {
  return normalizeBookListGroupBy(getConfigurationValue('bookListGroupBy'));
}

export function getSettings(): ReadOnBushSettings {
  return {
    lineWidth: getLineWidth(),
    defaultReadingMode: getDefaultReadingMode(),
    autoRefreshBookList: getAutoRefreshBookList(),
    statusBarPrefix: getStatusBarPrefix(),
    showProgress: getShowProgress(),
    bookListGroupBy: getBookListGroupBy()
  };
}

export function affectsReadOnBushConfiguration(event: ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(AppName);
}

export function affectsSetting(
  event: ConfigurationChangeEvent,
  key: ReadOnBushSettingKey
): boolean {
  return event.affectsConfiguration(`${AppName}.${key}`);
}
