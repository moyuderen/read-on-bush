import { type ExtensionContext } from 'vscode';
import { BookCatalog } from './BookCatalog';
import { ReaderDisplayManager } from '../presentation/reader';
import { CamouflageTemplateService } from '../presentation/reader/rendering';
import message from '../utils/message';
import type { ReadingNotifier } from '../domain/books';
import { createDefaultBookFormatRegistry, type BookFormatRegistry } from '../formats';
import { ReadingSession } from './ReadingSession';
import { PrivacyService } from './PrivacyService';
import {
  SurfaceRouter,
  ReaderViewSurface,
  TerminalSurface
} from '../presentation/readerSurfaces';
import { getCamouflageSurface } from '../config/settings';

export class ApplicationContext {
  public context: ExtensionContext;
  public readerViewPanel: ReaderViewSurface;
  public readerSurface: SurfaceRouter;
  public terminalSurface: TerminalSurface;
  public bookList: BookCatalog;
  public templateService: CamouflageTemplateService;
  public displayManager: ReaderDisplayManager;
  public formatRegistry: BookFormatRegistry;
  public readonly notifier: ReadingNotifier;
  public readingSession: ReadingSession;
  public privacyDisplay: PrivacyService;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.privacyDisplay = new PrivacyService();
    this.notifier = {
      info: (text) => message(text),
      warn: (text) => message.warn(text),
      error: (text) => message.error(text)
    };
    this.formatRegistry = createDefaultBookFormatRegistry(context.globalStorageUri);
    this.templateService = new CamouflageTemplateService();
    this.readerViewPanel = new ReaderViewSurface(context.extensionUri);
    this.terminalSurface = new TerminalSurface(context);
    this.readerSurface = new SurfaceRouter(
      this.terminalSurface,
      this.readerViewPanel,
      getCamouflageSurface()
    );
    this.readingSession = new ReadingSession(this);
    this.displayManager = new ReaderDisplayManager(
      context,
      this.templateService,
      this.privacyDisplay,
      this.readerSurface
    );
    this.bookList = new BookCatalog(this);
    context.subscriptions.push(this.bookList);
  }

  showIdleReaderHint(): void {
    if (this.readingSession.current) {
      return;
    }
    this.displayManager.showIdleHint();
  }

  /** 热切换伪装显示载体。清理旧载体 → 切换代理 → 重新渲染当前内容。 */
  swapCamouflageSurface(): void {
    const surface = getCamouflageSurface();
    this.readerSurface.swapTo(surface);

    this.displayManager.refresh(this.readingSession.currentTxtState);
    this.readingSession.refreshSettings();
    this.showIdleReaderHint();
  }
}
