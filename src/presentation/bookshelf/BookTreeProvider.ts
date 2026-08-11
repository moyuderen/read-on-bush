import * as vscode from 'vscode';
import {
  type BookData,
  getRecentBooks,
  type BookFormat,
  type ChapterRef,
  type EpubProgress,
  type PdfProgress
} from '../../domain/books';
import type { BookNavigationTarget } from '../../domain/books';
import { uncategorizedBookGroupName } from '../../config/bookGroups';
import { getBookGroupDescriptor } from './bookGrouping';
import { Commands } from '../../config/commands';
import { getRecentBookCount, type BookListGroupBy } from '../../config/settings';
import type { BookFormatRegistry } from '../../formats';
import {
  getBookDisplayName,
  getBookTooltip,
  PrivacyService,
  type PrivacyDisplayMode
} from '../../application/PrivacyService';

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
    hasOutline = false,
    format: BookFormat = bookData.format ?? 'txt',
    private readonly privacyDisplayMode: PrivacyDisplayMode = 'normal'
  ) {
    super(
      name,
      hasOutline ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    this.label = `《${this.name}》`;
    this.tooltip = getBookTooltip(bookData, privacyDisplayMode);
    this.iconPath = new vscode.ThemeIcon(getBookIcon(format));
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
    if (this.privacyDisplayMode === 'private') {
      this.description = `读至：第${this.currentChapterIndex + 1}节`;
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
    isCurrent: boolean,
    privacyDisplayMode: PrivacyDisplayMode = 'normal'
  ) {
    const targetIndex =
      target.kind === 'section'
        ? target.sectionIndex
        : target.kind === 'page'
          ? target.pageIndex
          : undefined;
    const displayTitle =
      privacyDisplayMode === 'private' && targetIndex !== undefined
        ? `第${targetIndex + 1}节`
        : title;
    super(displayTitle, vscode.TreeItemCollapsibleState.None);
    this.label = isCurrent ? `▸ ${displayTitle}` : displayTitle;
    this.tooltip = isCurrent ? `${displayTitle}（当前位置）` : displayTitle;
    this.iconPath = new vscode.ThemeIcon(isCurrent ? 'circle-filled' : 'circle-outline');
    this.command = {
      title: displayTitle,
      command: Commands.OpenBookOutline,
      arguments: [{ bookId, target }]
    };
  }
}

export class BookTreeGroupItem extends vscode.TreeItem {
  public readonly type = 'group';

  constructor(public name: string, public children: BookTreeBookItem[]) {
    super(name, vscode.TreeItemCollapsibleState.Expanded);

    this.label = name;
    this.tooltip = name;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = this.type;
  }
}

export type BookTreeItem = BookTreeBookItem | BookTreeGroupItem | BookTreeOutlineItem;

function createBookTreeItem(
  book: BookData,
  registry: BookFormatRegistry,
  privacyDisplay: PrivacyService
): BookTreeBookItem {
  const provider = registry.getProviderForBook(book);
  const privacyDisplayMode = privacyDisplay.currentMode;
  return new BookTreeBookItem(
    book,
    getBookDisplayName(book, privacyDisplayMode),
    book.id,
    book.url,
    book.process,
    book.category,
    book.chapters,
    book.pdfProgress?.pageIndex ?? book.epubProgress?.chapterIndex,
    !!provider?.getOutline,
    provider?.format ?? book.format,
    privacyDisplayMode
  );
}

function getBookIcon(format: BookFormat): string {
  switch (format) {
    case 'txt':
      return 'file-text';
    case 'epub':
      return 'book';
    case 'pdf':
      return 'file-pdf';
    default:
      return 'book';
  }
}

export class BookTreeProvider
  implements vscode.TreeDataProvider<BookTreeItem>, vscode.TreeDragAndDropController<BookTreeItem>
{
  private static readonly dndMimeType = 'application/vnd.code.tree.bookList';

  readonly dragMimeTypes = [BookTreeProvider.dndMimeType];
  readonly dropMimeTypes = [BookTreeProvider.dndMimeType];

  public books: BookTreeItem[];
  private groupBy: BookListGroupBy;

  /** 拖拽改分类回调，由 BookCatalog 注入（避免 Provider 直接依赖 storage）。 */
  onReassignCategory?: (bookIds: string[], category: string | undefined) => void;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    void | BookTreeItem | BookTreeItem[] | null | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly registry: BookFormatRegistry,
    private readonly privacyDisplay: PrivacyService,
    books: BookData[] = [],
    groupBy: BookListGroupBy = 'none'
  ) {
    this.groupBy = groupBy;
    this.books = this.buildTreeItems(books, groupBy);
  }

  updateBooks(books: BookData[], groupBy: BookListGroupBy = 'none'): void {
    this.groupBy = groupBy;
    this.books = this.buildTreeItems(books, groupBy);
    this.refresh();
  }

  updateBookProcess(id: string, process: number): void {
    for (const book of this.findAllBookItems(id, this.books)) {
      book.process = process;
      book.bookData.process = process;
      this._onDidChangeTreeData.fire(book);
    }
  }

  /** epub 进度变化：只在跨章时刷新书籍行与目录高亮，章内翻页不重建整棵树。 */
  updateEpubProgress(id: string, progress: EpubProgress): void {
    for (const book of this.findAllBookItems(id, this.books)) {
      if (book.currentChapterIndex === progress.chapterIndex) {
        continue;
      }
      book.bookData.epubProgress = progress;
      book.setCurrentChapter(progress.chapterIndex);
      this._onDidChangeTreeData.fire(book);
    }
  }

  /** pdf 进度变化：只在跨页时刷新书籍行与目录高亮，页内翻页不重建整棵树。 */
  updatePdfProgress(id: string, progress: PdfProgress): void {
    for (const book of this.findAllBookItems(id, this.books)) {
      if (book.currentChapterIndex === progress.pageIndex) {
        continue;
      }
      book.bookData.pdfProgress = progress;
      book.setCurrentChapter(progress.pageIndex);
      this._onDidChangeTreeData.fire(book);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  handleDrag(source: readonly BookTreeItem[], dataTransfer: vscode.DataTransfer): void {
    // 仅在按分类分组时启用拖拽改分类，其它分组方式拖拽无意义。
    if (this.groupBy !== 'category') {
      return;
    }
    const bookIds = source
      .filter((item): item is BookTreeBookItem => item.type === 'book')
      .map((book) => book.id);
    if (bookIds.length === 0) {
      return;
    }
    dataTransfer.set(BookTreeProvider.dndMimeType, new vscode.DataTransferItem(bookIds));
  }

  handleDrop(target: BookTreeItem | undefined, dataTransfer: vscode.DataTransfer): void {
    if (this.groupBy !== 'category' || !this.onReassignCategory) {
      return;
    }
    const item = dataTransfer.get(BookTreeProvider.dndMimeType);
    const bookIds = item?.value;
    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      return;
    }
    const category = this.resolveDropCategory(target);
    if (category === null) {
      return;
    }
    this.onReassignCategory(bookIds, category);
  }

  /**
   * 解析拖拽落点对应的目标分类。
   * @returns string 设为该分类 / undefined 清除分类 / null 无效落点（不操作）
   */
  private resolveDropCategory(target: BookTreeItem | undefined): string | undefined | null {
    if (!target) {
      // 拖到空白处 = 清除分类。
      return undefined;
    }
    if (target.type === 'group') {
      // 「最近阅读」分组不可作为拖拽落点。
      if (target.contextValue === 'recentGroup') {
        return null;
      }
      // 「未分类」分组即清除分类，其它分组名为分类名。
      return target.name === uncategorizedBookGroupName ? undefined : target.name;
    }
    if (target.type === 'book') {
      // 拖到某本书上 = 归入该书所在分类。
      return target.category ?? undefined;
    }
    // 拖到章节大纲项上 = 无效。
    return null;
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
            isCurrentOutlineTarget(item.target, element.currentChapterIndex),
            this.privacyDisplay.currentMode
          )
      );
    }

    return [];
  }

  /** 查找指定 id 的所有书籍项（同一本书可能同时出现在最近阅读和正常分组中）。 */
  private findAllBookItems(id: string, items: BookTreeItem[]): BookTreeBookItem[] {
    const result: BookTreeBookItem[] = [];
    for (const item of items) {
      if (item.type === 'book' && item.id === id) {
        result.push(item);
      }

      if (item.type === 'group') {
        result.push(...this.findAllBookItems(id, item.children));
      }
    }

    return result;
  }

  private buildTreeItems(books: BookData[], groupBy: BookListGroupBy): BookTreeItem[] {
    const baseItems =
      groupBy === 'none'
        ? books.map((book) => createBookTreeItem(book, this.registry, this.privacyDisplay))
        : this.buildGroupedItems(books, groupBy);

    const recentGroup = this.buildRecentGroup(books);
    return recentGroup ? [recentGroup, ...baseItems] : baseItems;
  }

  private buildGroupedItems(books: BookData[], groupBy: BookListGroupBy): BookTreeItem[] {
    const groups = new Map<
      string,
      { name: string; rawName: string; children: BookTreeBookItem[] }
    >();

    for (const book of books) {
      const { key, name, rawName } = getBookGroupDescriptor(
        book,
        groupBy,
        this.privacyDisplay
      );
      const group = groups.get(key) ?? { name, rawName, children: [] };
      group.children.push(createBookTreeItem(book, this.registry, this.privacyDisplay));
      groups.set(key, group);
    }

    return [...groups.values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .map(({ name, rawName, children }) => {
        const item = new BookTreeGroupItem(name, children);
        // 按分类分组时，非「未分类」的分组允许重命名；拖拽改分类也仅在此模式生效。
        if (groupBy === 'category' && rawName !== uncategorizedBookGroupName) {
          item.contextValue = 'categoryGroup';
        }
        return item;
      });
  }

  /** 构建置顶的「最近阅读」分组；无记录或已禁用时返回 undefined。 */
  private buildRecentGroup(books: BookData[]): BookTreeGroupItem | undefined {
    const limit = getRecentBookCount();
    if (limit <= 0) {
      return undefined;
    }

    const recentBooks = getRecentBooks(books, limit);

    if (recentBooks.length === 0) {
      return undefined;
    }

    const children = recentBooks.map((book) => {
      const item = createBookTreeItem(book, this.registry, this.privacyDisplay);
      item.contextValue = 'recentBook';
      return item;
    });

    const group = new BookTreeGroupItem('最近阅读', children);
    group.iconPath = new vscode.ThemeIcon('history');
    group.contextValue = 'recentGroup';
    return group;
  }
}

function isCurrentOutlineTarget(
  target: BookNavigationTarget,
  currentChapterIndex: number | undefined
): boolean {
  return target.kind === 'section' && target.sectionIndex === currentChapterIndex;
}
