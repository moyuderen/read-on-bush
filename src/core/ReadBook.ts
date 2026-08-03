import { type ExtensionContext } from 'vscode';
import { BookList } from './BookList';
import { Book } from './Book';
import { ReadingDisplayManager } from './display';
import { CamouflageTemplateService } from './display/camouflageTemplateService';
import { EpubReader } from './EpubReader';
import { PdfReader } from './PdfReader';
import { createDefaultBookFormatRegistry, type BookFormatRegistry } from '../formats';
import { ReadingSessionService } from '../app/services';

export class ReadBook {
  public context: ExtensionContext;
  public bookList: BookList;
  public readingBook?: Book;
  public templateService: CamouflageTemplateService;
  public displayManager: ReadingDisplayManager;
  public epubReader: EpubReader;
  public pdfReader: PdfReader;
  public formatRegistry: BookFormatRegistry;
  public readingSession: ReadingSessionService;

  constructor(context: ExtensionContext) {
    this.context = context;
    this.formatRegistry = createDefaultBookFormatRegistry();
    this.templateService = new CamouflageTemplateService();
    this.displayManager = new ReadingDisplayManager(context, this.templateService);
    this.epubReader = new EpubReader(this);
    this.pdfReader = new PdfReader(this);
    this.readingSession = new ReadingSessionService(this);
    this.bookList = new BookList(this);
  }
}
