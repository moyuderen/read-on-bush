import type { StatusBarItem, ExtensionContext } from 'vscode';
import { window, StatusBarAlignment, commands } from 'vscode';
import { Commands, CustomWhenClauseContext } from './Commands';
import { StatusBarPriority } from './config';

function setupKeyBindingsBarItem(context: ExtensionContext) {
  setupActiveBarItem(context);
  setupDisableBarItem(context);

  commands.executeCommand(Commands.DisableKeyBinding);
}

let activeBarItem: StatusBarItem;

function setupActiveBarItem(context: ExtensionContext) {
  activeBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.ActiveKeyBind);
  activeBarItem.command = Commands.ActiveKeyBinding;
  context.subscriptions.push(activeBarItem);
  activeBarItem.text = `$(code) Coding`;
  activeBarItem.tooltip = 'To Reading mode';
  activeBarItem.show();
  const activeKeyBindingsStatus = commands.registerCommand(Commands.ActiveKeyBinding, () => {
    commands.executeCommand('setContext', CustomWhenClauseContext.KeyBindingsStatus, true);
    disableBarItem.show();
    activeBarItem.hide();
  });

  context.subscriptions.push(activeKeyBindingsStatus);
}

let disableBarItem: StatusBarItem;
function setupDisableBarItem(context: ExtensionContext) {
  disableBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.DisableKeyBind);
  disableBarItem.command = Commands.DisableKeyBinding;
  context.subscriptions.push(disableBarItem);
  disableBarItem.text = `$(vr) Reading`;
  disableBarItem.tooltip = 'TO Coding mode';
  disableBarItem.show();
  const disableKeyBindingsStatus = commands.registerCommand(Commands.DisableKeyBinding, () => {
    commands.executeCommand('setContext', CustomWhenClauseContext.KeyBindingsStatus, false);
    disableBarItem.hide();
    activeBarItem.show();
  });

  context.subscriptions.push(disableKeyBindingsStatus);
}

export {
  setupKeyBindingsBarItem,
  activeBarItem,
  disableBarItem
};
