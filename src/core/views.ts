import { commands } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { app } from './index';
import { Commands } from './commands';


export function setupViewTitleImport(context: ExtensionContext) {
  commands.registerCommand(Commands.ImportBook, () => {
    app.bookList.addBook();
  });
  
}