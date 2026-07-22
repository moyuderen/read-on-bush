import { window, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../config';
import { Commands } from '../Commands';

export let terminalCamouflageBarItem: StatusBarItem;

export function setupTerminalCamouflageBarItem(context: ExtensionContext) {
  if (terminalCamouflageBarItem) {
    return;
  }

  terminalCamouflageBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    StatusBarPriority.TerminalCamouflage
  );
  terminalCamouflageBarItem.command = Commands.ToggleTerminalCamouflage;
  terminalCamouflageBarItem.text = '$(terminal)';
  terminalCamouflageBarItem.tooltip = 'Toggle Terminal';
  terminalCamouflageBarItem.show();
  context.subscriptions.push(terminalCamouflageBarItem);
}
