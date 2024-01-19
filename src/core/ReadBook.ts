import { type ExtensionContext, commands } from 'vscode';
import { BookList } from './BookList';

export type Plugin = {
  install:(app: ReadBook) => ReadBook,
  [key: string]: any
};
export class ReadBook {
  public context: ExtensionContext;
  public bookList: BookList;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.bookList = new BookList(context);
  }
}

