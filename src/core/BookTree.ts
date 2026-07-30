import * as vscode from 'vscode';
import { type BookData, type ChapterRef, type EpubProgress, type PdfProgress } from './Book';
import type { BookNavigationTarget } from '../domain/books';
import { getBookGroupName } from './bookGroups';
import { Commands } from './Commands';
import type { BookListGroupBy } from './settings';
import type { BookFormatRegistry } from '../formats';

export class BookTreeBookItem extends vscode.TreeItem {
  public readonly type = 'book';

  constructor(
    public readonly bookData: BookData,
    public name: string,
    public id: string,
    public url: string,
    public process: number = 0,
    public category?: string,
    public chapters?: ChapterRef[],
    public currentChapterIndex?: number,
    hasOutline = false
  ) {
    super(
      name,
      hasOutline ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.label = `《${this.name}》`;
    this.tooltip = `${this.url}`;
    this.iconPath = new vscode.ThemeIcon('book');
    this.contextValue = this.type;
    this.command = {
      title: this.name,
      command: Commands.OpenBook,
      arguments: [this]
    };
    this.applyCurrentOutline();
  }

  /** 翻页时增量更新当前目录项：改描述并刷新本行（不重建整棵树，避免展开被收起）。 */
  setCurrentChapter(chapterIndex: number | undefined): void {
    this.currentChapterIndex = chapterIndex;
    this.applyCurrentOutline();
  }

  private applyCurrentOutline(): void {
    if (this.currentChapterIndex === undefined || !this.chapters) {
      this.description = undefined;
      return;
    }
    const title = this.chapters[this.currentChapterIndex]?.title?.trim();
    // 直接用 TOC 标题，与终端进度文案一致（不自行合成章号，避免与书本身编号错位）
    this.description = title
      ? `读至：${title}`
      : `读至：第${this.currentChapterIndex + 1}章`;
  }
}

export class BookTreeOutlineItem extends vscode.TreeItem {
  public readonly type = 'outline';
  public readonly contextValue = 'outline';

  constructor(
    public bookId: string,
    public target: BookNavigationTarget,
    title: string,
    isCurrent: boolean
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.label = isCurrent ? `▸ ${title}` : title;
    this.tooltip = isCurrent ? `${title}（当前位置）` : title;
    this.iconPath = new vscode.ThemeIcon(isCurrent ? 'circle-filled' : 'circle-outline');
    this.command = {
      title,
      command: Commands.OpenBookOutline,
      arguments: [{ bookId, target }]
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

export type BookTreeItem = BookTreeBookItem | BookTreeGroupItem | BookTreeOutlineItem;

function createBookTreeItem(book: BookData, registry: BookFormatRegistry): BookTreeBookItem {
  const provider = registry.getProviderForBook(book);
  return new BookTreeBookItem(
    book,
    book.name,
    book.id,
    book.url,
    book.process,
    book.category,
    book.chapters,
    book.pdfProgress?.pageIndex ?? book.epubProgress?.chapterIndex,
    !!provider?.getOutline
  );
}

export class BookTreeProvider implements vscode.TreeDataProvider<BookTreeItem> {
  public books: BookTreeItem[];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    void | BookTreeItem | BookTreeItem[] | null | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly registry: BookFormatRegistry,
    books: BookData[] = [],
    groupBy: BookListGroupBy = 'none'
  ) {
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
      book.bookData.process = process;
      this._onDidChangeTreeData.fire(book);
    }
  }

  /** epub 进度变化：只在跨章时刷新书籍行与目录高亮，章内翻页不重建整棵树。 */
  updateEpubProgress(id: string, progress: EpubProgress): void {
    const book = this.findBookItem(id, this.books);

    if (!book || book.currentChapterIndex === progress.chapterIndex) {
      return;
    }

    book.bookData.epubProgress = progress;
    book.setCurrentChapter(progress.chapterIndex);
    this._onDidChangeTreeData.fire(book);
  }

  /** pdf 进度变化：只在跨页时刷新书籍行与目录高亮，页内翻页不重建整棵树。 */
  updatePdfProgress(id: string, progress: PdfProgress): void {
    const book = this.findBookItem(id, this.books);

    if (!book || book.currentChapterIndex === progress.pageIndex) {
      return;
    }

    book.bookData.pdfProgress = progress;
    book.setCurrentChapter(progress.pageIndex);
    this._onDidChangeTreeData.fire(book);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BookTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: BookTreeItem | undefined): Promise<BookTreeItem[]> {
    if (!element) {
      return this.books;
    }

    if (element.type === 'group') {
      return element.children;
    }

    if (element.type === 'book') {
      const provider = this.registry.getProviderForBook(element.bookData);
      const outline = await provider?.getOutline?.(element.bookData);

      if (!outline) {
        return [];
      }

      return outline.map(
        (item) =>
          new BookTreeOutlineItem(
            element.id,
            item.target,
            item.title,
            isCurrentOutlineTarget(item.target, element.currentChapterIndex)
          )
      );
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
      return books.map((book) => createBookTreeItem(book, this.registry));
    }

    const groups = new Map<string, BookTreeBookItem[]>();

    for (const book of books) {
      const groupName = getBookGroupName(book, groupBy);
      const groupBooks = groups.get(groupName) ?? [];
      groupBooks.push(createBookTreeItem(book, this.registry));
      groups.set(groupName, groupBooks);
    }

    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .map(([name, children]) => new BookTreeGroupItem(name, children));
  }
}

function isCurrentOutlineTarget(
  target: BookNavigationTarget,
  currentChapterIndex: number | undefined
): boolean {
  return target.kind === 'section' && target.sectionIndex === currentChapterIndex;
}
