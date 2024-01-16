
import * as vscode from 'vscode';
// import init from './main';
import message from './utils/message';
import { setup } from './index';

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "readOnBush" is now active!');

	let disposable = vscode.commands.registerCommand('readOnBush.helloWorld', () => {
    message();
	});

	context.subscriptions.push(disposable);

  // init(context);
  setup(context);
}

export function deactivate() {}
