import type { EpubProgress, PdfProgress, BookData } from './BookData';
import type { ReadingDisplayState } from './ReadingDisplayState';

export interface ReadingNotifier {
  info(text: string): void;
  warn(text: string): void;
  error(text: string): void;
}

export interface BookProgressPort {
  updateBookProcess(id: string, process: number): void;
  updateEpubProgress(id: string, progress: EpubProgress): void;
  updatePdfProgress(id: string, progress: PdfProgress): void;
}

export interface TxtDisplayPort {
  getNextProcessStep(state: ReadingDisplayState): number;
  getPrevProcessStep(state: ReadingDisplayState): number;
  render(state: ReadingDisplayState): void;
  pause(state: ReadingDisplayState): void;
}

export interface ReadingPrivacyPort {
  readonly isPrivate: boolean;
  getBookMessageName(book: BookData): string;
}

export interface TxtReadingPort {
  readonly currentTxtState?: ReadingDisplayState;
  readonly currentTxtPageCount: number;
  nextTxt(): Promise<void>;
  previousTxt(): Promise<void>;
  jumpTxt(pageIndex: number): Promise<void>;
  startTxt(): void;
  stopTxt(): void;
}
