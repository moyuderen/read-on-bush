import type {
  BookData,
  BookFormat,
  BookNavigationTarget,
  BookOutlineItem,
  BookProgressPort,
  ReadingDisplayState,
  ReadingNotifier,
  ReadingPrivacyPort,
  TxtDisplayPort
} from '../domain/books';
import type { SearchDocument } from '../domain/search';
import type { CamouflageTemplateService } from '../presentation/reader/rendering';
import type { ResolvedTerminalTemplate } from '../presentation/readerTemplates';
import type { ReaderSurface } from '../presentation/readerSurfaces';

export type ImportBookInput = {
  id: string;
  name: string;
  filePath: string;
  /** 进度通知/错误提示中使用的显示名称（隐私模式下已脱敏）。 */
  displayName?: string;
  /** 批量导入时设为 true，跳过单本书的进度通知。 */
  silent?: boolean;
};

export type ReaderPrivacy = ReadingPrivacyPort & {
  getImageTitle(book: BookData): string;
  applyTerminalPrivacy(template: ResolvedTerminalTemplate): ResolvedTerminalTemplate;
};

export type BookCatalogPort = BookProgressPort & {
  syncChapters(id: string, chapters: { title: string }[]): BookData | undefined;
  /** 立即执行尚未触发的防抖进度写入并等待持久化完成。 */
  flushProgressWrite(): Promise<void>;
};

export type ReaderServices = {
  readerSurface: ReaderSurface;
  templateService: CamouflageTemplateService;
  privacyDisplay: ReaderPrivacy;
  bookCatalog: BookCatalogPort;
  notifier: ReadingNotifier;
  txtDisplay: TxtDisplayPort;
};

export type CreateReaderInput = {
  book: BookData;
  services: ReaderServices;
};

export type ReaderJumpOptions = {
  persistProgress?: boolean;
};

export type TxtReaderCapability = {
  readonly currentTxtState?: ReadingDisplayState;
  readonly currentTxtPageCount: number;
  start(): void;
  stop(): void;
};

export interface BookReaderController {
  readonly book: BookData;
  readonly format: BookFormat;
  readonly txt?: TxtReaderCapability;

  open(): Promise<boolean>;
  close(): Promise<void>;
  dispose?(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  jumpTo?(target: BookNavigationTarget, options?: ReaderJumpOptions): Promise<void>;
  getCurrentLocation?(): BookNavigationTarget | undefined;
  getSearchDocument?(): SearchDocument | undefined;
  refreshSettings?(): void;
  refreshPrivacyDisplay?(): void;
  toggleAutoTurn?(): void;
  disposeAutoTurn?(): void;
}

export interface BookFormatProvider {
  readonly format: BookFormat;
  readonly supportedExtensions: readonly string[];

  importBook(input: ImportBookInput): Promise<BookData>;
  createReader(input: CreateReaderInput): BookReaderController;
  getOutline?(book: BookData): Promise<BookOutlineItem[]>;
  deleteCache?(book: BookData): Promise<void>;
  loadSearchDocument?(book: BookData): Promise<SearchDocument>;
  /** 清除该 provider 的全部缓存文件。 */
  clearCache?(): Promise<void>;
  /** 该 provider 缓存当前占用字节数。 */
  getCacheSize?(): Promise<number>;
  setCacheLimitBytes?(maxSizeBytes: number): Promise<void>;
}
