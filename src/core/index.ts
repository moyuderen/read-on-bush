import { type ExtensionContext } from 'vscode';
import { ReadBook } from "./ReadBook";
import { setupStorage } from '../utils/storage';
import { setupBars } from './barItems';

export let app: ReadBook;

export function setup(context: ExtensionContext) {
  setupStorage(context);
  setupBars(context);

  app = new ReadBook(context);
  return app;
}