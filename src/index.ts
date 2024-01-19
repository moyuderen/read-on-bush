import { type ExtensionContext } from 'vscode';
import { ReadBook } from "./core/ReadBook";
import { setupStorage } from './utils/storage';
import { setupHandler } from './core/handler';

function setup(context: ExtensionContext) {
  setupStorage(context);
  setupHandler(context);
  const app = new ReadBook(context);

  return app;
}

export {
  setup
};