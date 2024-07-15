import * as vscode from 'vscode';
import message from './utils/message';
import { setup } from './core/index';

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "readOnBush" is now active!');

  // demo
  let disposable = vscode.commands.registerCommand('readOnBush.helloWorld', () => {
    message();
  });

  context.subscriptions.push(disposable);

  const app = setup(context);

  if (!app.readingBook) {
    message('Please select the book you want to read !');
  }
}

export function deactivate() {}
