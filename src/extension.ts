import * as vscode from 'vscode';
import type { ApplicationContext } from './application/ApplicationContext';
import { setup } from './application/bootstrap';

let app: ApplicationContext | undefined;

export function activate(context: vscode.ExtensionContext): void {
  app = setup(context);
}

export async function deactivate(): Promise<void> {
  await app?.bookList.flushProgressWrite();
}
