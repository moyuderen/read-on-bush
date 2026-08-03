import { workspace } from 'vscode';
import type { ConfigurationChangeEvent } from 'vscode';
import { AppName, LineWidth } from './config';

export const BOOK_LIST_GROUP_BY_OPTIONS = ['none', 'category', 'directory'] as const;
export const READING_DISPLAY_TARGET_OPTIONS = ['statusBar', 'terminalCamouflage', 'both'] as const;
export const BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS = [
  'buildLog',
  'claudeCli',
  'serverLog',
  'vite',
  'docker'
] as const;
export const TERMINAL_CAMOUFLAGE_STYLE_OPTIONS = [
  ...BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS,
  'custom'
] as const;

export type BookListGroupBy = (typeof BOOK_LIST_GROUP_BY_OPTIONS)[number];
export type ReadingDisplayTarget = (typeof READING_DISPLAY_TARGET_OPTIONS)[number];
export type BuiltinTerminalCamouflageStyle =
  (typeof BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS)[number];
export type TerminalCamouflageStyle = (typeof TERMINAL_CAMOUFLAGE_STYLE_OPTIONS)[number];

export type ReadOnBushSettings = {
  lineWidth: number;
  defaultReadingMode: boolean;
  autoRefreshBookList: boolean;
  statusBarPrefix: string;
  showProgress: boolean;
  displayTarget: ReadingDisplayTarget;
  terminalCamouflageLineWidth: number;
  terminalCamouflageLineCount: number;
  terminalCamouflageStyle: TerminalCamouflageStyle;
  terminalCamouflageCustomTemplate: unknown;
  bookListGroupBy: BookListGroupBy;
};

export const defaultSettings: ReadOnBushSettings = {
  lineWidth: LineWidth.Default,
  defaultReadingMode: true,
  autoRefreshBookList: false,
  statusBarPrefix: '',
  showProgress: true,
  displayTarget: 'statusBar',
  terminalCamouflageLineWidth: 0,
  terminalCamouflageLineCount: 3,
  terminalCamouflageStyle: 'claudeCli',
  terminalCamouflageCustomTemplate: null,
  bookListGroupBy: 'none'
};

export type ReadOnBushSettingKey = keyof ReadOnBushSettings;

function normalizeNumber(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function normalizeLineWidth(lineWidth: number): number {
  return normalizeNumber(lineWidth, defaultSettings.lineWidth, LineWidth.Min, LineWidth.Max);
}

function normalizeEnum<T extends readonly string[]>(value: string, options: T, fallback: T[number]): T[number] {
  return options.includes(value) ? value : fallback;
}

function normalizeBookListGroupBy(groupBy: string): BookListGroupBy {
  return normalizeEnum(groupBy, BOOK_LIST_GROUP_BY_OPTIONS, defaultSettings.bookListGroupBy);
}

function normalizeDisplayTarget(displayTarget: string): ReadingDisplayTarget {
  return normalizeEnum(displayTarget, READING_DISPLAY_TARGET_OPTIONS, defaultSettings.displayTarget);
}

function normalizeTerminalCamouflageStyle(style: string): TerminalCamouflageStyle {
  return normalizeEnum(
    style,
    TERMINAL_CAMOUFLAGE_STYLE_OPTIONS,
    defaultSettings.terminalCamouflageStyle
  );
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

export function getDisplayTarget(): ReadingDisplayTarget {
  return normalizeDisplayTarget(getConfigurationValue('displayTarget'));
}

export function getTerminalCamouflageLineWidth(): number {
  return normalizeNumber(
    getConfigurationValue('terminalCamouflageLineWidth'),
    defaultSettings.terminalCamouflageLineWidth,
    0,
    200
  );
}

export function getTerminalCamouflageLineCount(): number {
  return normalizeNumber(
    getConfigurationValue('terminalCamouflageLineCount'),
    defaultSettings.terminalCamouflageLineCount,
    1,
    10
  );
}

export function getTerminalCamouflageStyle(): TerminalCamouflageStyle {
  return normalizeTerminalCamouflageStyle(getConfigurationValue('terminalCamouflageStyle'));
}

export function getTerminalCamouflageCustomTemplate(): unknown {
  return getConfigurationValue('terminalCamouflageCustomTemplate');
}

export type TerminalCamouflageTemplateSettings = {
  style: TerminalCamouflageStyle;
  customTemplate: unknown;
};

export function getTerminalCamouflageTemplateSettings(): TerminalCamouflageTemplateSettings {
  return {
    style: getTerminalCamouflageStyle(),
    customTemplate: getTerminalCamouflageCustomTemplate()
  };
}

export function shouldShowStatusBarReading(): boolean {
  const displayTarget = getDisplayTarget();
  return displayTarget === 'statusBar' || displayTarget === 'both';
}

export function shouldShowTerminalCamouflage(): boolean {
  const displayTarget = getDisplayTarget();
  return displayTarget === 'terminalCamouflage' || displayTarget === 'both';
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
    displayTarget: getDisplayTarget(),
    terminalCamouflageLineWidth: getTerminalCamouflageLineWidth(),
    terminalCamouflageLineCount: getTerminalCamouflageLineCount(),
    terminalCamouflageStyle: getTerminalCamouflageStyle(),
    terminalCamouflageCustomTemplate: getTerminalCamouflageCustomTemplate(),
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
