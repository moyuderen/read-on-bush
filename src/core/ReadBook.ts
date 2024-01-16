import { type ExtensionContext } from 'vscode';
import { BookList } from './BookList';

export type Plugin = {
  install:(app: ReadBook) => ReadBook,
  [key: string]: any
};

export class ReadBook {
  public context: ExtensionContext;
  public bookList: BookList | null;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.bookList = null;
  }

  use(plugin: Plugin) {
    plugin.install && plugin.install(this);
  }
}

