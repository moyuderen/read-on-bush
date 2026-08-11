import fs from 'fs';
import path from 'path';
import { window, commands, workspace, env, Uri, QuickPickItemKind, ProgressLocation } from 'vscode';
import { type Disposable, type ExtensionContext, type TreeView } from 'vscode';
import { BookTreeProvider, BookTreeItem, BookTreeBookItem } from '../presentation/bookshelf/BookTreeProvider';
import { ApplicationContext } from './ApplicationContext';
import {
  BookData,
  getRecentBooks,
  type ChapterRef,
  type EpubProgress,
  type PdfProgress
} from '../domain/books';
import type { BookNavigationTarget } from '../domain/books';
import message from '../utils/message';
import { generateId } from '../utils/generateId';
import { getBookGroupName } from '../config/bookGroups';
import { AppName } from '../config/constants';
import { Commands, CustomWhenClauseContext } from '../config/commands';
import { CLOUDCONVERT_URL, summarizeConvertible } from '../config/convertGuide';
import { getBookListGroupBy, getRecentBookCount, type BookListGroupBy } from '../config/settings';
import {
  BookStore,
  GlobalStateBookStore
} from '../infrastructure/storage/BookStore';
import { PrivacyService, getBookDisplayName } from './PrivacyService';
import { DebouncedTask } from '../utils/debounce';

type SortType =
  | 'nameAsc'
  | 'nameDesc'
  | 'progressAsc'
  | 'progressDesc'
  | 'createdAtAsc'
  | 'createdAtDesc'
  | 'group';

type GroupByOption = {
  label: string;
  description: string;
  value: BookListGroupBy;
};

type SortableBook = {
  book: BookData;
  createdAt: number;
  groupName: string;
  name: string;
  order: number;
  process: number;
};

type CategoryPickItem = {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  kind?: QuickPickItemKind;
  action?: 'create' | 'clear';
};

export class BookCatalog implements Disposable {
  public app: ApplicationContext;
  public context: ExtensionContext;
  public books: BookData[];
  private readonly bookTreeProvider: BookTreeProvider;
  private readonly bookStorage: BookStore;
  private readonly privacyDisplay: PrivacyService;
  private readonly treeView: TreeView<BookTreeItem>;

  /**
   * 翻页时连续写入进度会产生大量序列化与树刷新开销。这里把三种进度写入合并为一次
   * 防抖写入：快速翻页时 500ms 内只持久化/刷新一次。closeCurrent / dispose 时会 flush。
   */
  private readonly progressDebounce = new DebouncedTask(500);

  /**
   * 待执行的进度写入任务，按 `类型:bookId` 去重。
   * 防抖窗口内不同类型/不同书籍的更新各自记录最新值，flush 时全部执行——
   * 避免一种类型的更新被另一种类型的 schedule 覆盖丢弃。
   */
  private readonly pendingProgress = new Map<string, () => void>();

  constructor(app: ApplicationContext, bookStorage: BookStore = new GlobalStateBookStore()) {
    this.app = app;
    this.context = app.context;
    this.bookStorage = bookStorage;
    this.privacyDisplay = app.privacyDisplay;
    this.books = this.bookStorage.getBooks();
    this.bookTreeProvider = new BookTreeProvider(
      this.app.formatRegistry,
      this.privacyDisplay,
      this.books,
      getBookListGroupBy()
    );
    this.bookTreeProvider.onReassignCategory = (bookIds, category) => {
      this.reassignCategory(bookIds, category);
    };
    this.treeView = window.createTreeView('readOnBush-bookList', {
      treeDataProvider: this.bookTreeProvider,
      dragAndDropController: this.bookTreeProvider
    });
    this.context.subscriptions.push(this.treeView);
    this.initCommands();
    this.updatePrivacyDisplayContext();
  }

  getBooks(): BookData[] {
    this.books = this.bookStorage.getBooks();
    return this.books;
  }

  initCommands() {
    this.context.subscriptions.push(
      commands.registerCommand(Commands.OpenBook, (event) => {
        this.openOnBook(event);
      }),
      commands.registerCommand(Commands.OpenBookOutline, (event) => {
        this.openBookOutline(event);
      }),
      commands.registerCommand(Commands.DeleteBook, (event) => {
        if (this.isBookItem(event)) {
          this.deleteBook(event.bookId);
        }
      }),
      commands.registerCommand(Commands.RenameBook, (event) => {
        this.renameBook(event);
      }),
      commands.registerCommand(Commands.SortBookList, () => {
        this.sortBookList();
      }),
      commands.registerCommand(Commands.SetBookCategory, (event) => {
        this.setBookCategory(event);
      }),
      commands.registerCommand(Commands.ClearBookCategory, (event) => {
        this.clearBookCategory(event);
      }),
      commands.registerCommand(Commands.SetPrivacyAlias, (event) => {
        void this.setPrivacyAlias(event);
      }),
      commands.registerCommand(Commands.TogglePrivacyDisplay, () => {
        this.togglePrivacyDisplay();
      }),
      commands.registerCommand(Commands.EnablePrivacyDisplay, () => {
        this.setPrivacyDisplayMode(true);
      }),
      commands.registerCommand(Commands.DisablePrivacyDisplay, () => {
        this.setPrivacyDisplayMode(false);
      }),
      commands.registerCommand(Commands.CreateCategory, () => {
        this.createCategory();
      }),
      commands.registerCommand(Commands.RenameCategory, (event) => {
        this.renameCategory(event);
      }),
      commands.registerCommand(Commands.SwitchBookListGroupBy, () => {
        this.switchBookListGroupBy();
      }),
      commands.registerCommand(Commands.ClearCache, () => {
        void this.clearCache();
      }),
      commands.registerCommand(Commands.ContinueReading, () => {
        void this.continueReading();
      }),
      commands.registerCommand(Commands.RemoveFromRecent, (event) => {
        if (this.isBookItem(event)) {
          this.removeFromRecent(event.bookId);
        }
      }),
      commands.registerCommand(Commands.SearchBook, () => {
        void this.searchBook();
      })
    );
  }

  async openOnBook(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    const bookData = await this.getExistingBookForOpen(book.bookId);
    if (!bookData) {
      return;
    }

    await this.app.readingSession.open(bookData);
  }

  async openBookOutline(event: unknown) {
    const { bookId, target } = (event ?? {}) as {
      bookId?: string;
      target?: BookNavigationTarget;
    };

    if (!bookId || !target) {
      return;
    }

    const bookData = await this.getExistingBookForOpen(bookId);

    if (!bookData) {
      return;
    }

    if (this.app.readingSession.current?.book.id !== bookData.id) {
      await this.app.readingSession.open(bookData);
    }

    await this.app.readingSession.jumpTo(target);
  }

  private async getExistingBookForOpen(bookId: string): Promise<BookData | undefined> {
    const bookData = this.books.find((item) => item.id === bookId);

    if (!bookData) {
      return undefined;
    }

    if (fs.existsSync(bookData.url)) {
      return bookData;
    }

    const action = await window.showWarningMessage(
      `文件不存在，是否从书架移除${this.privacyDisplay.getBookMessageName(bookData)}？`,
      '移除',
      '保留'
    );

    if (action === '移除') {
      this.deleteBook(bookData.id, '已从书架移除');
    }

    return undefined;
  }

  updateBookTreeProvider() {
    this.bookTreeProvider.updateBooks(this.books, getBookListGroupBy());
  }

  togglePrivacyDisplay() {
    this.setPrivacyDisplayMode(!this.privacyDisplay.isPrivate);
  }

  private setPrivacyDisplayMode(isPrivate: boolean): void {
    if (this.privacyDisplay.isPrivate === isPrivate) {
      return;
    }

    const mode = this.privacyDisplay.setMode(isPrivate ? 'private' : 'normal');
    this.updatePrivacyDisplayContext();
    this.updateBookTreeProvider();
    const currentTxtState = this.app.readingSession.currentTxtState;
    if (currentTxtState) {
      this.app.displayManager.refresh(currentTxtState);
    }
    this.app.readingSession.refreshPrivacyDisplay();
    message(mode === 'private' ? '隐私界面模式已开启' : '隐私界面模式已关闭');
  }

  private updatePrivacyDisplayContext(): void {
    void commands.executeCommand(
      'setContext',
      CustomWhenClauseContext.IsPrivacyDisplay,
      this.privacyDisplay.isPrivate
    );
  }

  deleteBook(id: string, successMessage = 'Delete successful !') {
    const deletedBook = this.books.find((book) => book.id === id);
    this.books = this.bookStorage.deleteBook(id);
    this.updateBookTreeProvider();
    if (deletedBook) {
      const provider = this.app.formatRegistry.getProviderForBook(deletedBook);
      void provider?.deleteCache?.(deletedBook);
    }
    message(successMessage);
  }

  updateBookList(id: string, process: number): void {
    this.updateBookProcess(id, process);
  }

  updateBookProcess(id: string, process: number): void {
    this.scheduleProgressWrite(`process:${id}`, () => {
      this.books = this.bookStorage.updateBookProcess(id, process);
      this.bookTreeProvider.updateBookProcess(id, process);
    });
  }

  updateEpubProgress(id: string, progress: EpubProgress) {
    this.scheduleProgressWrite(`epub:${id}`, () => {
      this.books = this.bookStorage.updateEpubProgress(id, progress);
      this.bookTreeProvider.updateEpubProgress(id, progress);
    });
  }

  updatePdfProgress(id: string, progress: PdfProgress) {
    this.scheduleProgressWrite(`pdf:${id}`, () => {
      this.books = this.bookStorage.updatePdfProgress(id, progress);
      this.bookTreeProvider.updatePdfProgress(id, progress);
    });
  }

  /**
   * 记录一次进度写入任务并触发防抖。同一 key 的多次调用只保留最新值；
   * 不同 key 各自保留，flush 时全部执行。
   */
  private scheduleProgressWrite(key: string, task: () => void): void {
    this.pendingProgress.set(key, task);
    this.progressDebounce.schedule(() => this.drainPendingProgress());
  }

  /** 执行所有待处理的进度写入任务并清空队列。 */
  private drainPendingProgress(): void {
    for (const task of this.pendingProgress.values()) {
      task();
    }
    this.pendingProgress.clear();
  }

  /** 立即执行尚未触发的防抖进度写入，并等待持久化完成（关闭书籍/卸载扩展时调用）。 */
  async flushProgressWrite(): Promise<void> {
    this.progressDebounce.flush();
    await this.bookStorage.flush();
  }

  /** 记录书籍最近打开时间（不走防抖，打开是一次性事件，需立即写入）。 */
  markLastOpened(id: string): void {
    // 如果该书已是最近打开的，最近分组顺序不变，跳过重建避免折叠已展开的目录。
    const wasMostRecent = getRecentBooks(this.books, 1)[0]?.id === id;
    this.books = this.bookStorage.updateLastOpened(id);
    if (!wasMostRecent) {
      this.updateBookTreeProvider();
    }
  }

  /** 从「最近阅读」中移除（清除 lastOpenedAt，不删除书籍本身）。 */
  removeFromRecent(id: string): void {
    this.books = this.bookStorage.clearLastOpened(id);
    this.updateBookTreeProvider();
  }

  /** 继续阅读上次打开的书。 */
  async continueReading(): Promise<void> {
    const lastBook = getRecentBooks(this.books, 1)[0];

    if (!lastBook) {
      message('暂无阅读记录');
      return;
    }

    const bookData = await this.getExistingBookForOpen(lastBook.id);
    if (!bookData) {
      return;
    }

    await this.app.readingSession.open(bookData);
  }

  dispose(): void {
    this.progressDebounce.dispose();
  }

  syncChapters(id: string, chapters: ChapterRef[]): BookData | undefined {
    const existing = this.books.find((book) => book.id === id);
    const unchanged =
      existing?.chapters &&
      existing.chapters.length === chapters.length &&
      existing.chapters.every(
        (chapter, index) => chapter.title === chapters[index]?.title
      );

    if (unchanged) {
      return existing;
    }

    this.books = this.bookStorage.updateBookChapters(id, chapters);
    this.updateBookTreeProvider();
    return this.books.find((book) => book.id === id);
  }

  async addBook() {
    const files = await window.showOpenDialog({
      title: '选择书籍',
      canSelectMany: true,
      filters: {
        '书籍文件': this.app.formatRegistry.getAcknowledgedExtensions()
      }
    });

    if (!files || files.length === 0) {
      return;
    }

    const { supported, convertible } = this.partitionByFormat(files.map((file) => file.fsPath));
    await this.importClassified(supported, convertible, '所选书籍已在书架中');
  }

  async addBookDirectory() {
    const directories = await window.showOpenDialog({
      title: '选择书籍目录',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: '导入目录'
    });

    if (!directories || directories.length === 0) {
      return;
    }

    try {
      const { supported, convertible } = await this.getBookPathsInDirectory(directories[0].fsPath);

      if (supported.length === 0 && convertible.length === 0) {
        message.warn('所选目录下未找到支持的书籍文件');
        return;
      }

      await this.importClassified(supported, convertible, '目录中的书籍已在书架中');
    } catch {
      message.error('读取目录失败');
    }
  }

  async renameBook(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    const name = await window.showInputBox({
      value: book.bookData.name,
      prompt: '请输入新的书名',
      validateInput: (value) => (value.trim() ? undefined : '书名不能为空')
    });

    if (name === undefined) {
      return;
    }

    const nextName = name.trim();
    this.books = this.bookStorage.renameBook(book.bookId, nextName);
    this.updateBookTreeProvider();

    const currentReader = this.app.readingSession.current;
    if (currentReader?.book.id === book.bookId) {
      currentReader.book.name = nextName;
    }

    message('重命名成功');
  }

  async setPrivacyAlias(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    const alias = await window.showInputBox({
      value: book.bookData.privacyAlias ?? '',
      prompt: '请输入隐私模式下显示的名称，留空将清除别名',
      placeHolder: '例如：Project Notes'
    });

    if (alias === undefined) {
      return;
    }

    this.books = this.bookStorage.updateBookPrivacyAlias(book.bookId, alias);
    if (this.privacyDisplay.isPrivate) {
      this.updateBookTreeProvider();
    }
    message(alias.trim() ? '隐私别名已设置' : '隐私别名已清除');
  }

  async sortBookList() {
    const option = await window.showQuickPick(
      [
        { label: '按书名升序', sort: 'nameAsc' },
        { label: '按书名降序', sort: 'nameDesc' },
        { label: '按阅读进度升序', sort: 'progressAsc' },
        { label: '按阅读进度降序', sort: 'progressDesc' },
        { label: '按导入时间升序', sort: 'createdAtAsc' },
        { label: '按导入时间降序', sort: 'createdAtDesc' },
        { label: '按分类/目录名称排序', sort: 'group' }
      ] satisfies Array<{ label: string; sort: SortType }>,
      {
        placeHolder: '选择书架排序方式'
      }
    );

    if (!option) {
      return;
    }

    const collator = new Intl.Collator('zh-CN');
    const groupBy = getBookListGroupBy();
    const sortableBooks = this.books.map((book) => ({
      book,
      createdAt: book.createdAt ?? 0,
      groupName: getBookGroupName(book, groupBy),
      name: book.name,
      order: book.order ?? 0,
      process: book.process
    }));
    const sortedBooks = sortableBooks
      .sort((left, right) => this.compareSortableBooks(left, right, option.sort, collator))
      .map(({ book }) => book);

    this.books = sortedBooks.map((book, order) => ({
      ...book,
      order
    }));
    this.bookStorage.saveBooks(this.books);
    this.updateBookTreeProvider();
    message('排序已更新');
  }

  async setBookCategory(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    const currentCategory = book.category ?? '';
    const pick = await window.showQuickPick(this.buildCategoryPickItems(currentCategory), {
      placeHolder: currentCategory
        ? `当前分类：${currentCategory}，选择已有分类或创建新分类`
        : '选择已有分类或创建新分类'
    });

    if (!pick) {
      return;
    }

    if (pick.action === 'create') {
      const input = await window.showInputBox({
        value: currentCategory,
        prompt: '请输入分类名称，留空将清除分类'
      });
      if (input === undefined) {
        return;
      }
      this.applyBookCategory(book.bookId, input);
      return;
    }

    // 选择「清除分类」或已有分类时直接写入。
    this.applyBookCategory(book.bookId, pick.action === 'clear' ? '' : pick.label);
  }

  private applyBookCategory(bookId: string, category: string) {
    this.books = this.bookStorage.updateBookCategory(bookId, category);
    this.updateBookTreeProvider();
    message(category.trim() ? '分类已更新' : '分类已清除');
  }

  /** 拖拽落点批量改分类：单次读写 storage，避免逐条调用造成的多次持久化。 */
  reassignCategory(bookIds: string[], category: string | undefined) {
    const idSet = new Set(bookIds);
    const nextCategory = category?.trim() || undefined;
    let changed = false;

    this.books = this.books.map((book) => {
      if (idSet.has(book.id) && (book.category ?? '') !== (nextCategory ?? '')) {
        changed = true;
        return { ...book, category: nextCategory };
      }
      return book;
    });

    if (!changed) {
      return;
    }

    this.bookStorage.saveBooks(this.books);
    this.updateBookTreeProvider();
    message(nextCategory ? `已移动到「${nextCategory}」` : '已移出分类');
  }

  /** 新建分类：输入名称后多选书籍加入（空分类不会在树中显示，故创建时一并选书）。 */
  async createCategory() {
    if (this.books.length === 0) {
      message.warn('书架为空，请先导入书籍');
      return;
    }

    const input = await window.showInputBox({
      prompt: '请输入新分类名称',
      validateInput: (value) => (value.trim() ? undefined : '分类名称不能为空')
    });
    if (input === undefined) {
      return;
    }
    const categoryName = input.trim();

    const picks = await window.showQuickPick(
      this.books.map((book) => ({
        label: this.privacyDisplay.getBookDisplayName(book),
        description: book.category ? `当前：${book.category}` : '未分类',
        picked: false,
        bookId: book.id
      })),
      {
        canPickMany: true,
        placeHolder: `选择要加入「${categoryName}」的书籍`
      }
    );

    if (!picks || picks.length === 0) {
      return;
    }

    const idSet = new Set(picks.map((pick) => pick.bookId));
    this.books = this.books.map((book) =>
      idSet.has(book.id) ? { ...book, category: categoryName } : book
    );
    this.bookStorage.saveBooks(this.books);
    this.updateBookTreeProvider();
    message(`已创建分类「${categoryName}」，添加 ${picks.length} 本书`);
  }

  /** 重命名分类：批量更新该分类下所有书籍；若新名与已有分类重名则自动合并。 */
  async renameCategory(item: BookTreeItem) {
    if (item?.type !== 'group' || item.contextValue !== 'categoryGroup') {
      return;
    }
    const oldName = item.name;

    const input = await window.showInputBox({
      value: oldName,
      prompt: '请输入新的分类名称',
      validateInput: (value) => (value.trim() ? undefined : '分类名称不能为空')
    });
    if (input === undefined) {
      return;
    }
    const newName = input.trim();
    if (newName === oldName) {
      return;
    }

    const hasExisting = this.books.some((book) => book.category === newName);
    this.books = this.books.map((book) =>
      book.category === oldName ? { ...book, category: newName } : book
    );
    this.bookStorage.saveBooks(this.books);
    this.updateBookTreeProvider();
    message(hasExisting ? `已合并到「${newName}」` : `已重命名为「${newName}」`);
  }

  /** 构建分类选择列表：已有分类（按书名排序，标注当前分类与数量）+ 创建/清除入口。 */
  private buildCategoryPickItems(currentCategory: string): CategoryPickItem[] {
    const counts = new Map<string, number>();
    for (const item of this.books) {
      const category = item.category?.trim();
      if (category) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }

    const items: CategoryPickItem[] = Array.from(counts.keys())
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
      .map((category) => ({
        label: category,
        description: `${counts.get(category) ?? 0} 本`,
        detail: category === currentCategory ? '当前分类' : undefined,
        picked: category === currentCategory
      }));

    items.push({ label: '', kind: QuickPickItemKind.Separator });
    items.push({ label: '$(add) 创建新分类…', action: 'create' });

    if (currentCategory) {
      items.push({ label: '$(clear-all) 清除分类', action: 'clear' });
    }

    return items;
  }

  clearBookCategory(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    this.books = this.bookStorage.updateBookCategory(book.bookId);
    this.updateBookTreeProvider();
    message('分类已清除');
  }

  /**
   * QuickPick 模糊搜索书架中的书籍，选中后在树视图中高亮该书并直接打开阅读。
   */
  async searchBook(): Promise<void> {
    const bookItems = this.bookTreeProvider.getAllBookItems();
    if (bookItems.length === 0) {
      message.warn('书架中暂无书籍。');
      return;
    }

    const mode = this.privacyDisplay.currentMode;
    const items = bookItems.map((item) => {
      const book = item.bookData;
      const format = book.format?.toUpperCase() ?? '';
      const description =
        mode === 'private' || !book.category
          ? format
          : [format, book.category].join(' · ');
      return {
        label: getBookDisplayName(book, mode),
        description,
        detail: book.lastOpenedAt ? formatRelativeTime(book.lastOpenedAt) : undefined,
        treeItem: item,
      };
    });

    const pick = await window.showQuickPick(items, {
      placeHolder: '搜索书籍…',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!pick) {
      return;
    }

    const treeItem = pick.treeItem;
    const bookId = treeItem.bookId;

    // 只在阅读器成功打开后由 ReadingSession 记录最近阅读，避免失败打开污染最近阅读列表。
    await this.openOnBook(treeItem);

    // 使用当前树中的实例进行 reveal。即使打开流程未来触发了树刷新，
    // 这里也不会继续使用过期的 TreeItem 引用。
    const currentTreeItem = this.bookTreeProvider.findBookItem(bookId);
    if (!currentTreeItem) {
      return;
    }

    await commands.executeCommand('readOnBush-bookList.focus');
    try {
      await this.treeView.reveal(currentTreeItem, { select: true, focus: false, expand: true });
    } catch (error) {
      console.warn('无法定位搜索到的书籍:', error);
    }
  }

  async switchBookListGroupBy() {
    const options: GroupByOption[] = [
      { label: '不分组', description: '保持扁平书架', value: 'none' },
      { label: '按分类分组', description: '按书籍分类组织', value: 'category' },
      { label: '按目录分组', description: '按文件所在目录组织', value: 'directory' }
    ];
    const option = await window.showQuickPick(options, {
      placeHolder: '选择书架分组方式'
    });

    if (!option) {
      return;
    }

    await workspace.getConfiguration(AppName).update('bookListGroupBy', option.value, true);
    message('书架分组方式已更新');
  }

  /** 清除 EPUB/PDF 全部解析缓存；阅读进度不受影响，下次打开需重新解析。 */
  async clearCache() {
    const size = await this.app.formatRegistry.getTotalCacheSize();

    if (size === 0) {
      message('缓存为空，无需清除');
      return;
    }

    const action = await window.showWarningMessage(
      `确定清除全部缓存（当前 ${formatBytes(size)}）？阅读进度不受影响，但下次打开 EPUB/PDF 书籍时需要重新解析。`,
      '清除缓存',
      '取消'
    );

    if (action !== '清除缓存') {
      return;
    }

    await this.app.formatRegistry.clearAllCaches();
    message(`已清除全部缓存（${formatBytes(size)}）`);
  }

  private async getBookPathsInDirectory(
    directoryPath: string
  ): Promise<{ supported: string[]; convertible: string[] }> {
    const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const paths = files
      .filter((file) => file.isFile())
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .map((file) => path.join(directoryPath, file.name));

    return this.partitionByFormat(paths);
  }

  private async importClassified(
    supported: string[],
    convertible: string[],
    duplicateOnlyMessage: string
  ): Promise<void> {
    const books = this.bookStorage.getBooks();
    const bookPathKeys = new Set(books.map((book) => this.getBookPathKey(book.url, false)));
    const importTasks: Array<() => Promise<BookData>> = [];
    let skippedCount = 0;

    const isBatch = importTasks.length > 1;

    for (const filePath of supported) {
      const filePathKey = this.getBookPathKey(filePath);

      if (bookPathKeys.has(filePathKey)) {
        skippedCount++;
        continue;
      }

      bookPathKeys.add(filePathKey);
      importTasks.push(() => this.importBookPath(filePath, isBatch));
    }

    // 批量导入用单条汇总进度通知，避免 N 本并发弹 N 个通知。
    const nextBooks = isBatch
      ? await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: `正在导入 ${importTasks.length} 本书...`,
            cancellable: false
          },
          () => this.runInBatches(importTasks, 3)
        )
      : await this.runInBatches(importTasks, 3);

    if (nextBooks.length > 0) {
      const latestBooks = this.bookStorage.getBooks();
      const latestPathKeys = new Set(
        latestBooks.map((book) => this.getBookPathKey(book.url, false))
      );
      const booksToAdd = nextBooks.filter((book) => {
        const key = this.getBookPathKey(book.url, false);
        if (latestPathKeys.has(key)) {
          return false;
        }
        latestPathKeys.add(key);
        return true;
      });
      skippedCount += nextBooks.length - booksToAdd.length;

      if (booksToAdd.length > 0) {
        this.books = this.bookStorage.addBooks(booksToAdd, latestBooks);
        this.updateBookTreeProvider();
      }
    }

    // supported 导入结果消息（维持现有语义）。supported 为空时不弹重复提示，
    // 避免在「只有 convertible」时误报「已在书架中」。
    if (supported.length > 0 && nextBooks.length === 0) {
      message.warn(duplicateOnlyMessage);
    } else if (nextBooks.length > 0 && skippedCount > 0) {
      message(`已导入 ${nextBooks.length} 本书，跳过 ${skippedCount} 个重复路径`);
    } else if (nextBooks.length > 0) {
      message(`已导入 ${nextBooks.length} 本书`);
    }

    if (convertible.length > 0) {
      await this.guideConversion(convertible);
    }
  }

  /** 按格式分类路径：supported 直接导入、convertible 引导转换、unknown 忽略。分类规则集中在 registry。 */
  private partitionByFormat(paths: string[]): { supported: string[]; convertible: string[] } {
    const supported: string[] = [];
    const convertible: string[] = [];
    for (const filePath of paths) {
      const kind = this.app.formatRegistry.classifyPath(filePath);
      if (kind === 'supported') {
        supported.push(filePath);
      } else if (kind === 'convertible') {
        convertible.push(filePath);
      }
    }
    return { supported, convertible };
  }

  private async importBookPath(filePath: string, silent = false): Promise<BookData> {
    const provider = this.app.formatRegistry.getProviderByPath(filePath);
    const name = path.parse(filePath).base;
    return provider.importBook({
      name,
      id: generateId(),
      filePath,
      displayName: this.privacyDisplay.isPrivate ? '文档' : `《${name}》`,
      silent
    });
  }

  /** 汇总提示需转换的书籍（mobi/azw3/pdf），引导用户前往 CloudConvert 转 epub。 */
  private async guideConversion(convertiblePaths: string[]): Promise<void> {
    const formats = summarizeConvertible(convertiblePaths);
    const openExternalLabel = '前往 CloudConvert';
    const action = await window.showInformationMessage(
      `检测到 ${convertiblePaths.length} 本需转换的书籍（${formats.join('/')}），需先转 epub 才能阅读`,
      openExternalLabel
    );

    if (action === openExternalLabel) {
      await env.openExternal(Uri.parse(CLOUDCONVERT_URL));
    }
  }

  private async runInBatches<T>(tasks: Array<() => Promise<T>>, batchSize: number): Promise<T[]> {
    const results: T[] = [];

    for (let index = 0; index < tasks.length; index += batchSize) {
      results.push(...(await Promise.all(tasks.slice(index, index + batchSize).map((task) => task()))));
    }

    return results;
  }

  private isBookItem(book: BookTreeItem | undefined): book is BookTreeBookItem {
    return !!book && book.type === 'book';
  }

  private getBookPathKey(filePath: string, resolveRealPath = true): string {
    let normalizedPath = path.resolve(filePath);

    if (resolveRealPath) {
      try {
        normalizedPath = fs.realpathSync.native(filePath);
      } catch {
        normalizedPath = path.resolve(filePath);
      }
    }

    if (process.platform === 'win32' || process.platform === 'darwin') {
      return normalizedPath.toLowerCase();
    }

    return normalizedPath;
  }

  private compareSortableBooks(
    left: SortableBook,
    right: SortableBook,
    sortType: SortType,
    collator: Intl.Collator
  ): number {
    const fallback = left.order - right.order || collator.compare(left.name, right.name);

    switch (sortType) {
      case 'nameAsc':
        return collator.compare(left.name, right.name) || fallback;
      case 'nameDesc':
        return collator.compare(right.name, left.name) || fallback;
      case 'progressAsc':
        return left.process - right.process || fallback;
      case 'progressDesc':
        return right.process - left.process || fallback;
      case 'createdAtAsc':
        return left.createdAt - right.createdAt || fallback;
      case 'createdAtDesc':
        return right.createdAt - left.createdAt || fallback;
      case 'group':
        return collator.compare(left.groupName, right.groupName) || fallback;
      default:
        return fallback;
    }
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) {
    return '刚刚阅读';
  }
  if (minutes < 60) {
    return `${minutes} 分钟前阅读`;
  }
  if (hours < 24) {
    return `${hours} 小时前阅读`;
  }
  if (days < 30) {
    return `${days} 天前阅读`;
  }
  return `${new Date(timestamp).toLocaleDateString('zh-CN')} 阅读`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
