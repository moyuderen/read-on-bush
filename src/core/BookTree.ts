import * as vscode from 'vscode';
import { type BookData } from './Book';

export class BookTreeItem extends vscode.TreeItem {
  constructor(
    public name: string,
    public id: string,
    public url: string,
    public process: number = 0,
  ) {
    // super(name, vscode.TreeItemCollapsibleState.Collapsed);
    super(name, vscode.TreeItemCollapsibleState.None);

    this.name = name;
    this.id = id;
    this.url = url;
    this.label = `《${this.name}》`;
    this.process = process;
    this.tooltip = `${this.url}`;
    this.iconPath =  new vscode.ThemeIcon("book"); 
    // : new vscode.ThemeIcon("check");
    this.command = {
      title: this.name,
      command: 'readOnBush.openBook',
      arguments: [this]
    };
  }
}

export class BookTreeProvider implements vscode.TreeDataProvider<BookTreeItem> {
  public books: BookTreeItem[];

  constructor(books: BookData[] = []) {
    this.books = books.map(book => new BookTreeItem(
      book.name,
      book.id,
      book.url,
      book.process,
    ));
  }

  onDidChangeTreeData?: vscode.Event<void | BookTreeItem | BookTreeItem[] | null | undefined> | undefined;
  private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined | void> = new vscode.EventEmitter<BookTreeItem | undefined | void>();

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: BookTreeItem | undefined): vscode.ProviderResult<BookTreeItem[]> {
    return this.books;
  }

  getParent?(element: BookTreeItem): vscode.ProviderResult<BookTreeItem> {
    throw new Error('Method not implemented.');
  }

  resolveTreeItem?(item: vscode.TreeItem, element: BookTreeItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
    throw new Error('Method not implemented.');
  }
  
  onClick(element: BookTreeItem) {
    console.log(element);
  }
}

 
