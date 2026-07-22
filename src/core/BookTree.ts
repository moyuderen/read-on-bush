import * as vscode from 'vscode';
import { type BookData } from './Book';
import { getBookGroupName } from './bookGroups';
import { Commands } from './Commands';
import type { BookListGroupBy } from './settings';

export class BookTreeBookItem extends vscode.TreeItem {
  public readonly type = 'book';

  constructor(
    public name: string,
    public id: string,
    public url: string,
    public process: number = 0,
    public category?: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);

    this.label = `《${this.name}》`;
    this.tooltip = `${this.url}`;
    this.iconPath = new vscode.ThemeIcon('book');
    this.contextValue = this.type;
    this.command = {
      title: this.name,
      command: Commands.OpenBook,
      arguments: [this]
    };
  }
}

export class BookTreeGroupItem extends vscode.TreeItem {
  public readonly type = 'group';
  public readonly contextValue = 'group';

  constructor(public name: string, public children: BookTreeBookItem[]) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);

    this.label = name;
    this.tooltip = name;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export type BookTreeItem = BookTreeBookItem | BookTreeGroupItem;

function createBookTreeItem(book: BookData): BookTreeBookItem {
  return new BookTreeBookItem(book.name, book.id, book.url, book.process, book.category);
}

export class BookTreeProvider implements vscode.TreeDataProvider<BookTreeItem> {
  public books: BookTreeItem[];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    void | BookTreeItem | BookTreeItem[] | null | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(books: BookData[] = [], groupBy: BookListGroupBy = 'none') {
    this.books = this.buildTreeItems(books, groupBy);
  }

  updateBooks(books: BookData[], groupBy: BookListGroupBy = 'none'): void {
    this.books = this.buildTreeItems(books, groupBy);
    this.refresh();
  }

  updateBookProcess(id: string, process: number): void {
    const book = this.findBookItem(id, this.books);

    if (book) {
      book.process = process;
      this._onDidChangeTreeData.fire(book);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: BookTreeItem | undefined): vscode.ProviderResult<BookTreeItem[]> {
    if (!element) {
      return this.books;
    }

    if (element.type === 'group') {
      return element.children;
    }

    return [];
  }

  private findBookItem(id: string, items: BookTreeItem[]): BookTreeBookItem | undefined {
    for (const item of items) {
      if (item.type === 'book' && item.id === id) {
        return item;
      }

      if (item.type === 'group') {
        const book = this.findBookItem(id, item.children);

        if (book) {
          return book;
        }
      }
    }

    return undefined;
  }

  private buildTreeItems(books: BookData[], groupBy: BookListGroupBy): BookTreeItem[] {
    if (groupBy === 'none') {
      return books.map(createBookTreeItem);
    }

    const groups = new Map<string, BookTreeBookItem[]>();

    for (const book of books) {
      const groupName = getBookGroupName(book, groupBy);
      const groupBooks = groups.get(groupName) ?? [];
      groupBooks.push(createBookTreeItem(book));
      groups.set(groupName, groupBooks);
    }

    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .map(([name, children]) => new BookTreeGroupItem(name, children));
  }
}
