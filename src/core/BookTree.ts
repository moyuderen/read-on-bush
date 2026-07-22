import * as vscode from 'vscode';
import { type BookData } from './Book';
import { Commands } from './Commands';

export class BookTreeItem extends vscode.TreeItem {
  constructor(
    public name: string,
    public id: string,
    public url: string,
    public process: number = 0
  ) {
    // super(name, vscode.TreeItemCollapsibleState.Collapsed);
    super(name, vscode.TreeItemCollapsibleState.None);

    this.name = name;
    this.id = id;
    this.url = url;
    this.label = `《${this.name}》`;
    this.process = process;
    this.tooltip = `${this.url}`;
    this.iconPath = new vscode.ThemeIcon('book');
    // : new vscode.ThemeIcon("check");
    this.command = {
      title: this.name,
      command: Commands.OpenBook,
      arguments: [this]
    };
  }
}

export class BookTreeProvider implements vscode.TreeDataProvider<BookTreeItem> {
  public books: BookTreeItem[];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    void | BookTreeItem | BookTreeItem[] | null | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(books: BookData[] = []) {
    this.books = books.map((book) => new BookTreeItem(book.name, book.id, book.url, book.process));
  }

  updateBooks(books: BookData[]): void {
    this.books = books.map((book) => new BookTreeItem(book.name, book.id, book.url, book.process));
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: BookTreeItem | undefined): vscode.ProviderResult<BookTreeItem[]> {
    if (element) {
      return [];
    }

    return this.books;
  }

  onClick(element: BookTreeItem) {
    console.log(element);
  }
}
