import type { StatusBarItem, ExtensionContext } from 'vscode';
import { window, StatusBarAlignment, commands } from 'vscode';
import { Commands, CustomWhenClauseContext } from '../../config/commands';
import { StatusBarPriority } from '../../config/constants';
import { getDefaultReadingMode } from '../../config/settings';

export let codingModeBarItem: StatusBarItem;

export function applyReadingMode(enabled: boolean): void {
  commands.executeCommand('setContext', CustomWhenClauseContext.IsReadingMode, enabled);

  if (!readingModeBarItem || !codingModeBarItem) {
    return;
  }

  if (enabled) {
    readingModeBarItem.show();
    codingModeBarItem.hide();
    return;
  }

  readingModeBarItem.hide();
  codingModeBarItem.show();
}

function setupCodingModeBarItem(context: ExtensionContext) {
  if (codingModeBarItem) {
    return;
  }
  codingModeBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.ActiveKeyBind
  );
  codingModeBarItem.command = Commands.SwitchReadingMode;
  context.subscriptions.push(codingModeBarItem);
  codingModeBarItem.text = `$(code) Coding`;
  codingModeBarItem.tooltip = 'To Reading mode';
  codingModeBarItem.show();
  const activeKeyBindingsStatus = commands.registerCommand(Commands.SwitchReadingMode, () => {
    applyReadingMode(true);
  });

  context.subscriptions.push(activeKeyBindingsStatus);
}

export let readingModeBarItem: StatusBarItem;
function setupReadingModeBarItem(context: ExtensionContext) {
  if (readingModeBarItem) {
    return;
  }
  readingModeBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.DisableKeyBind
  );
  readingModeBarItem.command = Commands.SwitchCodingMode;
  context.subscriptions.push(readingModeBarItem);
  readingModeBarItem.text = `$(vr) Reading`;
  readingModeBarItem.tooltip = 'To Coding mode';
  readingModeBarItem.show();
  const disableKeyBindingsStatus = commands.registerCommand(Commands.SwitchCodingMode, () => {
    applyReadingMode(false);
  });

  context.subscriptions.push(disableKeyBindingsStatus);
}

export function setupModeBarItem(context: ExtensionContext) {
  setupCodingModeBarItem(context);
  setupReadingModeBarItem(context);

  applyReadingMode(getDefaultReadingMode());
}
