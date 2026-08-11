import * as vscode from 'vscode';
import { setup } from './application/bootstrap';

export function activate(context: vscode.ExtensionContext) {
  setup(context);
}

export function deactivate() {}
