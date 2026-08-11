import { workspace } from 'vscode';
import type { ConfigurationChangeEvent } from 'vscode';
import { AppName, LineWidth } from './constants';
import type { AutoTurnConfig } from '../domain/autoTurn';

export const BOOK_LIST_GROUP_BY_OPTIONS = ['none', 'category', 'directory'] as const;
export const READING_DISPLAY_TARGET_OPTIONS = ['statusBar', 'terminalCamouflage'] as const;
export const TXT_ENCODING_OPTIONS = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'gb18030'] as const;
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
export const IMAGE_PREVIEW_MODE_OPTIONS = ['thumbnail', 'large'] as const;
export const CAMOUFLAGE_SURFACE_OPTIONS = ['terminal', 'readerPanel'] as const;

export type BookListGroupBy = (typeof BOOK_LIST_GROUP_BY_OPTIONS)[number];
export type ReadingDisplayTarget = (typeof READING_DISPLAY_TARGET_OPTIONS)[number];
export type TxtEncodingSetting = (typeof TXT_ENCODING_OPTIONS)[number];
export type BuiltinTerminalCamouflageStyle =
  (typeof BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS)[number];
export type TerminalCamouflageStyle = (typeof TERMINAL_CAMOUFLAGE_STYLE_OPTIONS)[number];
export type ImagePreviewMode = (typeof IMAGE_PREVIEW_MODE_OPTIONS)[number];
export type CamouflageSurface = (typeof CAMOUFLAGE_SURFACE_OPTIONS)[number];

export type ReadOnBushSettings = {
  lineWidth: number;
  txtEncoding: TxtEncodingSetting;
  defaultReadingMode: boolean;
  privacyDisplayOnStart: boolean;
  autoRefreshBookList: boolean;
  statusBarPrefix: string;
  showProgress: boolean;
  showChapterTitle: boolean;
  imagePreviewMode: ImagePreviewMode;
  camouflageSurface: CamouflageSurface;
  displayTarget: ReadingDisplayTarget;
  terminalCamouflageLineWidth: number;
  terminalCamouflageLineCount: number;
  terminalCamouflageStyle: TerminalCamouflageStyle;
  terminalCamouflageCustomTemplate: unknown;
  bookListGroupBy: BookListGroupBy;
  recentBookCount: number;
  cacheLimitMB: number;
  autoTurnSpeed: number;
  autoTurnMinSeconds: number;
  autoTurnMaxSeconds: number;
  autoTurnFixedSeconds: number;
};

export const defaultSettings: ReadOnBushSettings = {
  lineWidth: LineWidth.Default,
  txtEncoding: 'auto',
  defaultReadingMode: true,
  privacyDisplayOnStart: false,
  autoRefreshBookList: false,
  statusBarPrefix: '',
  showProgress: true,
  showChapterTitle: true,
  imagePreviewMode: 'thumbnail',
  camouflageSurface: 'terminal',
  displayTarget: 'statusBar',
  terminalCamouflageLineWidth: 0,
  terminalCamouflageLineCount: 3,
  terminalCamouflageStyle: 'claudeCli',
  terminalCamouflageCustomTemplate: null,
  bookListGroupBy: 'none',
  recentBookCount: 5,
  cacheLimitMB: 100,
  autoTurnSpeed: 450,
  autoTurnMinSeconds: 2,
  autoTurnMaxSeconds: 30,
  autoTurnFixedSeconds: 0
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

function normalizeTxtEncoding(encoding: string): TxtEncodingSetting {
  return normalizeEnum(encoding, TXT_ENCODING_OPTIONS, defaultSettings.txtEncoding);
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

function normalizeImagePreviewMode(mode: string): ImagePreviewMode {
  return normalizeEnum(mode, IMAGE_PREVIEW_MODE_OPTIONS, defaultSettings.imagePreviewMode);
}

function normalizeCamouflageSurface(surface: string): CamouflageSurface {
  return normalizeEnum(surface, CAMOUFLAGE_SURFACE_OPTIONS, defaultSettings.camouflageSurface);
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

export function getTxtEncoding(): TxtEncodingSetting {
  return normalizeTxtEncoding(getConfigurationValue('txtEncoding'));
}

export function getDefaultReadingMode(): boolean {
  return getConfigurationValue('defaultReadingMode');
}

export function getPrivacyDisplayOnStart(): boolean {
  return getConfigurationValue('privacyDisplayOnStart');
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

export function getShowChapterTitle(): boolean {
  return getConfigurationValue('showChapterTitle');
}

export function getImagePreviewMode(): ImagePreviewMode {
  return normalizeImagePreviewMode(getConfigurationValue('imagePreviewMode'));
}

export function getDisplayTarget(): ReadingDisplayTarget {
  return normalizeDisplayTarget(getConfigurationValue('displayTarget'));
}

export function getCamouflageSurface(): CamouflageSurface {
  return normalizeCamouflageSurface(getConfigurationValue('camouflageSurface'));
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
  return getDisplayTarget() === 'statusBar';
}

export function shouldShowTerminalCamouflage(): boolean {
  return getDisplayTarget() === 'terminalCamouflage';
}

export function getBookListGroupBy(): BookListGroupBy {
  return normalizeBookListGroupBy(getConfigurationValue('bookListGroupBy'));
}

export function getRecentBookCount(): number {
  return normalizeNumber(
    getConfigurationValue('recentBookCount'),
    5,
    0,
    50
  );
}

export function getCacheLimitMB(): number {
  return normalizeNumber(
    getConfigurationValue('cacheLimitMB'),
    defaultSettings.cacheLimitMB,
    0,
    10000
  );
}

export function getAutoTurnSpeed(): number {
  return normalizeNumber(
    getConfigurationValue('autoTurnSpeed'),
    defaultSettings.autoTurnSpeed,
    1,
    9999
  );
}

export function getAutoTurnMinSeconds(): number {
  return normalizeNumber(
    getConfigurationValue('autoTurnMinSeconds'),
    defaultSettings.autoTurnMinSeconds,
    1,
    600
  );
}

export function getAutoTurnMaxSeconds(): number {
  return normalizeNumber(
    getConfigurationValue('autoTurnMaxSeconds'),
    defaultSettings.autoTurnMaxSeconds,
    1,
    600
  );
}

export function getAutoTurnFixedSeconds(): number {
  return normalizeNumber(
    getConfigurationValue('autoTurnFixedSeconds'),
    defaultSettings.autoTurnFixedSeconds,
    0,
    600
  );
}

export function getAutoTurnConfig(): AutoTurnConfig {
  return {
    speedCharsPerMin: getAutoTurnSpeed(),
    minSeconds: getAutoTurnMinSeconds(),
    maxSeconds: getAutoTurnMaxSeconds(),
    fixedSeconds: getAutoTurnFixedSeconds()
  };
}

export function getSettings(): ReadOnBushSettings {
  return {
    lineWidth: getLineWidth(),
    txtEncoding: getTxtEncoding(),
    defaultReadingMode: getDefaultReadingMode(),
    privacyDisplayOnStart: getPrivacyDisplayOnStart(),
    autoRefreshBookList: getAutoRefreshBookList(),
    statusBarPrefix: getStatusBarPrefix(),
    showProgress: getShowProgress(),
    showChapterTitle: getShowChapterTitle(),
    imagePreviewMode: getImagePreviewMode(),
    camouflageSurface: getCamouflageSurface(),
    displayTarget: getDisplayTarget(),
    terminalCamouflageLineWidth: getTerminalCamouflageLineWidth(),
    terminalCamouflageLineCount: getTerminalCamouflageLineCount(),
    terminalCamouflageStyle: getTerminalCamouflageStyle(),
    terminalCamouflageCustomTemplate: getTerminalCamouflageCustomTemplate(),
    bookListGroupBy: getBookListGroupBy(),
    recentBookCount: getRecentBookCount(),
    cacheLimitMB: getCacheLimitMB(),
    autoTurnSpeed: getAutoTurnSpeed(),
    autoTurnMinSeconds: getAutoTurnMinSeconds(),
    autoTurnMaxSeconds: getAutoTurnMaxSeconds(),
    autoTurnFixedSeconds: getAutoTurnFixedSeconds()
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
