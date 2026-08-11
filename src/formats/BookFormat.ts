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
import type { CamouflageTemplateService } from '../presentation/reader/rendering';
import type { ResolvedTerminalTemplate } from '../presentation/readerTemplates';
import type { ReaderSurface } from '../presentation/readerSurfaces';

export type ImportBookInput = {
  id: string;
  name: string;
  filePath: string;
};

export type ReaderPrivacy = ReadingPrivacyPort & {
  getImageTitle(book: BookData): string;
  applyTerminalPrivacy(template: ResolvedTerminalTemplate): ResolvedTerminalTemplate;
};

export type BookCatalogPort = BookProgressPort & {
  syncChapters(id: string, chapters: { title: string }[]): BookData | undefined;
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
  jumpTo?(target: BookNavigationTarget): Promise<void>;
  refreshSettings?(): void;
  refreshPrivacyDisplay?(): void;
}

export interface BookFormatProvider {
  readonly format: BookFormat;
  readonly supportedExtensions: readonly string[];

  importBook(input: ImportBookInput): Promise<BookData>;
  createReader(input: CreateReaderInput): BookReaderController;
  getOutline?(book: BookData): Promise<BookOutlineItem[]>;
  deleteCache?(book: BookData): Promise<void>;
}
