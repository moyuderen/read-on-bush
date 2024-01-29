import { type ExtensionContext } from 'vscode';
import { ReadBook } from "./ReadBook";
import { setupStorage } from '../utils/storage';
import { setupBars } from './barItems';
import { setupViewTitleImport } from './views';

export let app: ReadBook;

export function setup(context: ExtensionContext) {
  setupStorage(context);
  setupBars(context);
  setupViewTitleImport(context);

  app = new ReadBook(context);
  return app;
}