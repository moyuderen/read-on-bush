import { commands, window } from 'vscode';
import type { Disposable, ExtensionContext, QuickPick, QuickPickItem } from 'vscode';
import type { BookData, BookNavigationTarget, ReadingNotifier } from '../domain/books';
import {
  createSearchIndex,
  ReadingLocationStack,
  searchIndex,
  type SearchDocument,
  type SearchIndex,
  type SearchMatch,
  type SearchPage
} from '../domain/search';
import { Commands } from '../config/commands';
import type { BookReaderController, ReaderJumpOptions } from '../formats';
import type { BookFormatRegistry } from '../formats';
import type { PrivacyService } from './PrivacyService';

type SearchPickItem = QuickPickItem & {
  match?: SearchMatch;
  action?: 'loadMore' | 'back';
};

type SearchServiceDependencies = {
  context: ExtensionContext;
  formatRegistry: BookFormatRegistry;
  privacyDisplay: PrivacyService;
  notifier: ReadingNotifier;
  getCurrentReader: () => BookReaderController | undefined;
  jumpTo: (target: BookNavigationTarget, options?: ReaderJumpOptions) => Promise<void>;
};

const PAGE_SIZE = 100;

export class SearchService implements Disposable {
  private readonly locationStack = new ReadingLocationStack();
  private document?: SearchDocument;
  private currentSearchIndex?: SearchIndex;
  private documentBookId?: string;
  private documentPromise?: Promise<SearchDocument>;
  private documentGeneration = 0;
  private activeQuickPick?: QuickPick<SearchPickItem>;
  private disposed = false;

  constructor(private readonly dependencies: SearchServiceDependencies) {
    dependencies.context.subscriptions.push(
      commands.registerCommand(Commands.SearchCurrentBook, () => {
        void this.searchCurrentBook();
      }),
      commands.registerCommand(Commands.SearchBack, () => {
        void this.goBack();
      }),
      this
    );
  }

  async prewarm(book: BookData): Promise<void> {
    if (!this.canSearch(book)) {
      return;
    }

    try {
      await this.ensureDocument(book, this.dependencies.getCurrentReader());
    } catch {
      // 后台预热失败不打断打开阅读；用户按 f 时会看到明确错误。
    }
  }

  clear(bookId?: string): void {
    if (bookId && this.documentBookId !== bookId) {
      return;
    }
    this.activeQuickPick?.hide();
    this.activeQuickPick = undefined;
    this.documentGeneration++;
    this.document = undefined;
    this.currentSearchIndex = undefined;
    this.documentBookId = undefined;
    this.documentPromise = undefined;
    this.locationStack.clear();
  }

  async searchCurrentBook(): Promise<void> {
    const reader = this.dependencies.getCurrentReader();
    const book = reader?.book;
    if (!reader || !book || !this.canSearch(book, reader)) {
      this.dependencies.notifier.info('当前阅读内容暂不支持全文搜索');
      return;
    }
    if (
      (reader.format === 'txt' && reader.txt?.currentTxtState && !reader.txt.currentTxtState.isReading) ||
      (reader.format === 'epub' && !reader.getSearchDocument?.())
    ) {
      this.dependencies.notifier.info('请先开始阅读后再搜索');
      return;
    }

    this.activeQuickPick?.hide();
    const quickPick = window.createQuickPick<SearchPickItem>();
    this.activeQuickPick = quickPick;
    quickPick.placeholder = '输入关键词后按 Enter 搜索当前书籍';
    quickPick.matchOnDescription = true;
    quickPick.ignoreFocusOut = true;

    let query = '';
    let executedQuery: string | undefined;
    let nextOffset = 0;
    let requestGeneration = 0;
    let hasMore = false;
    let loadedResultCount = 0;
    let isClosed = false;

    const setItems = (items: SearchPickItem[]): void => {
      if (!isClosed) {
        quickPick.items = items;
      }
    };

    const runQuery = async (value: string): Promise<void> => {
      const trimmed = value.trim();
      if (!trimmed) {
        quickPick.busy = false;
        setItems([{ label: '请输入搜索内容' }]);
        return;
      }
      if (Array.from(trimmed).length > 256) {
        quickPick.busy = false;
        setItems([{ label: '搜索内容不能超过 256 个字符' }]);
        return;
      }

      const currentRequest = ++requestGeneration;
      quickPick.busy = true;
      setItems([{ label: '正在准备全文…' }]);
      try {
        const document = await this.ensureDocument(book, reader);
        if (isClosed || currentRequest !== requestGeneration) {
          return;
        }

        const page = searchIndex(this.currentSearchIndex!, trimmed, PAGE_SIZE);
        executedQuery = trimmed;
        nextOffset = page.nextOffset;
        hasMore = page.hasMore;
        loadedResultCount = page.matches.length;
        setItems(this.createPickItems(document, page, hasMore, 0, true));
      } catch {
        if (!isClosed && currentRequest === requestGeneration) {
          executedQuery = trimmed;
          setItems([{ label: '全文准备失败', description: '可修改关键词后重试' }]);
        }
      } finally {
        if (!isClosed && currentRequest === requestGeneration) {
          quickPick.busy = false;
        }
      }
    };

    const loadMore = async (): Promise<void> => {
      if (!this.document || !executedQuery || !hasMore || quickPick.busy) {
        return;
      }
      const currentRequest = ++requestGeneration;
      quickPick.busy = true;
      const currentItems = quickPick.items.filter((item) => item.action !== 'loadMore');
      try {
        const page = searchIndex(this.currentSearchIndex!, executedQuery, PAGE_SIZE, nextOffset);
        if (isClosed || currentRequest !== requestGeneration) {
          return;
        }
        nextOffset = page.nextOffset;
        hasMore = page.hasMore;
        const previousCount = loadedResultCount;
        loadedResultCount += page.matches.length;
        quickPick.items = [
          ...currentItems,
          ...this.createPickItems(this.document, page, hasMore, previousCount, false)
        ];
      } finally {
        if (!isClosed && currentRequest === requestGeneration) {
          quickPick.busy = false;
        }
      }
    };

    quickPick.onDidChangeValue((value) => {
      requestGeneration++;
      quickPick.busy = false;
      query = value;
      executedQuery = undefined;
      hasMore = false;
      setItems([]);
    });

    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      if (selected?.action === 'loadMore') {
        void loadMore();
        return;
      }
      if (selected?.action === 'back') {
        isClosed = true;
        quickPick.hide();
        void this.goBack();
        return;
      }
      if (selected?.match && executedQuery === query.trim()) {
        isClosed = true;
        quickPick.hide();
        void this.selectMatch(book, selected.match);
        return;
      }
      void runQuery(query);
    });

    quickPick.onDidHide(() => {
      isClosed = true;
      requestGeneration++;
      if (this.activeQuickPick === quickPick) {
        this.activeQuickPick = undefined;
      }
      quickPick.dispose();
    });

    const initialItems: SearchPickItem[] = [];
    if (this.locationStack.size > 0) {
      initialItems.push(this.createBackItem());
    }
    setItems(initialItems);
    quickPick.show();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clear();
  }

  private async selectMatch(book: BookData, match: SearchMatch): Promise<void> {
    const reader = this.dependencies.getCurrentReader();
    if (!reader || reader.book.id !== book.id) {
      return;
    }

    const currentLocation = reader.getCurrentLocation?.();
    if (currentLocation) {
      this.locationStack.push({ bookId: book.id, target: currentLocation });
    }
    await this.dependencies.jumpTo(match.target, { persistProgress: false });
  }

  private async goBack(): Promise<void> {
    const reader = this.dependencies.getCurrentReader();
    const bookId = reader?.book.id;
    if (!reader || !bookId) {
      return;
    }

    const target = this.locationStack.pop(bookId);
    if (!target) {
      this.dependencies.notifier.info('没有可返回的搜索位置');
      return;
    }
    await this.dependencies.jumpTo(target, { persistProgress: false });
  }

  private createBackItem(): SearchPickItem {
    return { label: '返回搜索前位置', alwaysShow: true, action: 'back' };
  }

  private createPickItems(
    document: SearchDocument,
    page: SearchPage,
    hasMoreResults: boolean,
    resultOffset: number,
    includeBack: boolean
  ): SearchPickItem[] {
    const items: SearchPickItem[] = [];
    if (includeBack && this.locationStack.size > 0) {
      items.push(this.createBackItem());
    }

    if (page.matches.length === 0) {
      items.push({ label: '未找到匹配内容', description: '请修改关键词后按 Enter 重试' });
      return items;
    }

    items.push(
      ...page.matches.map((match, index) => {
        const segment = document.segments[match.segmentIndex];
        const position = this.getPositionLabel(document, segment, match);
        const item: SearchPickItem = {
          alwaysShow: true,
          label: this.dependencies.privacyDisplay.isPrivate
            ? `结果 ${resultOffset + index + 1}`
            : `结果 ${resultOffset + index + 1} · ${position}`,
          description: this.dependencies.privacyDisplay.isPrivate
            ? `第 ${match.segmentIndex + 1} 个位置`
            : position,
          match
        };
        if (!this.dependencies.privacyDisplay.isPrivate) {
          item.detail = match.preview;
        }
        return item;
      })
    );

    if (hasMoreResults) {
      items.push({ label: '加载更多（100+）', alwaysShow: true, action: 'loadMore' });
    }
    return items;
  }


  private getPositionLabel(
    document: SearchDocument,
    segment: SearchDocument['segments'][number],
    match: SearchMatch
  ): string {
    if (document.format === 'txt') {
      return `第 ${(match.target.kind === 'page' ? match.target.pageIndex : segment.index) + 1} 段`;
    }
    return segment.title || `第 ${segment.index + 1} 章`;
  }

  private async ensureDocument(
    book: BookData,
    reader?: BookReaderController
  ): Promise<SearchDocument> {
    if (this.document?.bookId === book.id) {
      this.currentSearchIndex ??= createSearchIndex(this.document);
      return this.document;
    }

    const readerDocument = reader?.book.id === book.id ? reader.getSearchDocument?.() : undefined;
    if (readerDocument) {
      this.documentGeneration++;
      this.documentPromise = undefined;
      this.documentBookId = book.id;
      this.document = readerDocument;
      this.currentSearchIndex = createSearchIndex(readerDocument);
      return readerDocument;
    }
    if (this.documentPromise && this.documentBookId === book.id) {
      return this.documentPromise;
    }

    const provider = this.dependencies.formatRegistry.getProviderForBook(book);
    if (!provider?.loadSearchDocument) {
      throw new Error('当前格式暂不支持全文搜索');
    }

    this.documentGeneration++;
    const generation = this.documentGeneration;
    this.documentBookId = book.id;
    this.document = undefined;
    const documentPromise = provider.loadSearchDocument(book);
    this.documentPromise = documentPromise;
    try {
      const document = await documentPromise;
      if (generation === this.documentGeneration && this.documentBookId === book.id) {
        this.document = document;
        this.currentSearchIndex = createSearchIndex(document);
      }
      return document;
    } finally {
      if (this.documentBookId === book.id && this.documentPromise === documentPromise) {
        this.documentPromise = undefined;
      }
    }
  }

  private canSearch(book: BookData, reader?: BookReaderController): boolean {
    const readerCanSearch = reader?.book.id === book.id && reader.getSearchDocument !== undefined;
    const providerCanSearch =
      this.dependencies.formatRegistry.getProviderForBook(book)?.loadSearchDocument !== undefined;
    return readerCanSearch || providerCanSearch;
  }
}
