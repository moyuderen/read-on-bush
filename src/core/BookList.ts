import fs from 'fs';
import path from 'path';
import { window, commands, workspace } from 'vscode';
import { type ExtensionContext } from 'vscode';
import { BookTreeProvider, BookTreeItem, BookTreeBookItem } from './BookTree';
import { ReadBook } from './ReadBook';
import { Book, BookData } from './Book';
import message from '../utils/message';
import { generateId } from '../utils/generateId';
import { getBookGroupName } from './bookGroups';
import { AppName } from './config';
import { Commands } from './Commands';
import { isSupportedBookPath, supportedBookExtensions } from './parsers';
import { getBookListGroupBy, type BookListGroupBy } from './settings';
import {
  BookStorage,
  GlobalStateBookStorage
} from './storage/BookStorage';

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

export class BookList {
  public app: ReadBook;
  public context: ExtensionContext;
  public books: BookData[];
  private readonly bookTreeProvider: BookTreeProvider;
  private readonly bookStorage: BookStorage;

  constructor(app: ReadBook, bookStorage: BookStorage = new GlobalStateBookStorage()) {
    this.app = app;
    this.context = app.context;
    this.bookStorage = bookStorage;
    this.books = this.bookStorage.getBooks();
    this.bookTreeProvider = new BookTreeProvider(this.books, getBookListGroupBy());
    this.context.subscriptions.push(
      window.registerTreeDataProvider('bookList', this.bookTreeProvider)
    );
    this.initCommands();
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
      commands.registerCommand(Commands.DeleteBook, (event) => {
        if (this.isBookItem(event)) {
          this.deleteBook(event.id);
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
      commands.registerCommand(Commands.SwitchBookListGroupBy, () => {
        this.switchBookListGroupBy();
      })
    );
  }

  async openOnBook(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    if (!fs.existsSync(book.url)) {
      const action = await window.showWarningMessage(
        `文件不存在，是否从书架移除《${book.name}》？`,
        '移除',
        '保留'
      );

      if (action === '移除') {
        this.deleteBook(book.id, '已从书架移除');
      }

      return;
    }

    const { id, name, process, url, category } = book;
    this.app.readingBook = new Book({ id, name, process, url, category }, this.app);
  }

  updateBookTreeProvider() {
    this.bookTreeProvider.updateBooks(this.books, getBookListGroupBy());
  }

  deleteBook(id: string, successMessage = 'Delete successful !') {
    this.books = this.bookStorage.deleteBook(id);
    this.updateBookTreeProvider();
    message(successMessage);
  }

  updateBookList(id: string, process: number) {
    this.books = this.bookStorage.updateBookProcess(id, process);
    this.bookTreeProvider.updateBookProcess(id, process);
  }

  async addBook() {
    const files = await window.showOpenDialog({
      title: '选择书籍',
      canSelectMany: true,
      filters: {
        file: supportedBookExtensions
      }
    });

    if (!files || files.length === 0) {
      return;
    }

    this.importBookPaths(
      files.map((file) => file.fsPath),
      '所选书籍已在书架中'
    );
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
      const filePaths = await this.getSupportedBookPaths(directories[0].fsPath);

      if (filePaths.length === 0) {
        message.warn('所选目录下未找到支持的书籍文件');
        return;
      }

      this.importBookPaths(filePaths, '目录中的书籍已在书架中');
    } catch {
      message.error('读取目录失败');
    }
  }

  async renameBook(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    const name = await window.showInputBox({
      value: book.name,
      prompt: '请输入新的书名',
      validateInput: (value) => (value.trim() ? undefined : '书名不能为空')
    });

    if (name === undefined) {
      return;
    }

    const nextName = name.trim();
    this.books = this.bookStorage.renameBook(book.id, nextName);
    this.updateBookTreeProvider();

    if (this.app.readingBook?.book.id === book.id) {
      this.app.readingBook.book.name = nextName;
    }

    message('重命名成功');
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

    const category = await window.showInputBox({
      value: book.category ?? '',
      prompt: '请输入分类名称，留空将清除分类'
    });

    if (category === undefined) {
      return;
    }

    this.books = this.bookStorage.updateBookCategory(book.id, category);
    this.updateBookTreeProvider();
    message(category.trim() ? '分类已更新' : '分类已清除');
  }

  clearBookCategory(book: BookTreeItem) {
    if (!this.isBookItem(book)) {
      return;
    }

    this.books = this.bookStorage.updateBookCategory(book.id);
    this.updateBookTreeProvider();
    message('分类已清除');
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

  private async getSupportedBookPaths(directoryPath: string): Promise<string[]> {
    const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });

    return files
      .filter((file) => file.isFile() && isSupportedBookPath(file.name))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .map((file) => path.join(directoryPath, file.name));
  }

  private importBookPaths(filePaths: string[], duplicateOnlyMessage: string): void {
    const books = this.bookStorage.getBooks();
    const bookPathKeys = new Set(books.map((book) => this.getBookPathKey(book.url, false)));
    const nextBooks: BookData[] = [];
    let skippedCount = 0;

    for (const filePath of filePaths) {
      const filePathKey = this.getBookPathKey(filePath);

      if (bookPathKeys.has(filePathKey)) {
        skippedCount++;
        continue;
      }

      bookPathKeys.add(filePathKey);
      nextBooks.push({
        name: path.parse(filePath).base,
        id: generateId(),
        process: 0,
        url: filePath
      });
    }

    if (nextBooks.length === 0) {
      message.warn(duplicateOnlyMessage);
      return;
    }

    this.books = this.bookStorage.addBooks(nextBooks, books);
    this.updateBookTreeProvider();

    if (skippedCount > 0) {
      message(`已导入 ${nextBooks.length} 本书，跳过 ${skippedCount} 个重复路径`);
      return;
    }

    message(`已导入 ${nextBooks.length} 本书`);
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
