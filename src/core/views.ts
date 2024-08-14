import { commands } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { app } from './index';
import { Commands } from './Commands';

export function setupViewTitleImport(context: ExtensionContext) {
  commands.registerCommand(Commands.ImportBook, () => {
    app.bookList.addBook();
  });
}
