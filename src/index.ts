import { type ExtensionContext } from 'vscode';
import { ReadBook, type Plugin } from "./core/ReadBook";
import Storage from './utils/storage';
import BookList from './core/BookList';

function setup(context: ExtensionContext) {
  const app = new ReadBook(context);
  app.use(Storage);
  app.use(BookList);
}

export {
  setup
};