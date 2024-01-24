import type { StatusBarItem, ExtensionContext } from 'vscode';
import { window, StatusBarAlignment, commands } from 'vscode';
import { Commands, CustomWhenClauseContext } from '../commands';
import { StatusBarPriority } from '../config';

export let codingModeBarItem: StatusBarItem;

function setupCodingModeBarItem(context: ExtensionContext) {
  if(codingModeBarItem) {
    return; 
  }
  codingModeBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.ActiveKeyBind);
  codingModeBarItem.command = Commands.ActiveKeyBinding;
  context.subscriptions.push(codingModeBarItem);
  codingModeBarItem.text = `$(code) Coding`;
  codingModeBarItem.tooltip = 'To Reading mode';
  codingModeBarItem.show();
  const activeKeyBindingsStatus = commands.registerCommand(Commands.ActiveKeyBinding, () => {
    commands.executeCommand('setContext', CustomWhenClauseContext.KeyBindingsStatus, true);
    readingModeBarItem.show();
    codingModeBarItem.hide();
  });

  context.subscriptions.push(activeKeyBindingsStatus);
}

export let readingModeBarItem: StatusBarItem;
function setupReadingModeBarItem(context: ExtensionContext) {
  if(readingModeBarItem) {
    return; 
  }
  readingModeBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.DisableKeyBind);
  readingModeBarItem.command = Commands.DisableKeyBinding;
  context.subscriptions.push(readingModeBarItem);
  readingModeBarItem.text = `$(vr) Reading`;
  readingModeBarItem.tooltip = 'To Coding mode';
  readingModeBarItem.show();
  const disableKeyBindingsStatus = commands.registerCommand(Commands.DisableKeyBinding, () => {
    commands.executeCommand('setContext', CustomWhenClauseContext.KeyBindingsStatus, false);
    readingModeBarItem.hide();
    codingModeBarItem.show();
  });

  context.subscriptions.push(disableKeyBindingsStatus);
}

export function setupModeBarItem(context: ExtensionContext) {
  setupCodingModeBarItem(context);
  setupReadingModeBarItem(context);

  commands.executeCommand(Commands.ActiveKeyBinding);
}
