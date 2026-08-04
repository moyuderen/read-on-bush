import * as vscode from 'vscode';
import message from './utils/message';
import { setup } from './core/index';

export function activate(context: vscode.ExtensionContext) {
  // demo
  let disposable = vscode.commands.registerCommand('readOnBush.helloWorld', () => {
    message();
  });

  context.subscriptions.push(disposable);

  setup(context);
}

export function deactivate() {}
