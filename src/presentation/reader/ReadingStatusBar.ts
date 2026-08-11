import { contentBarItem, updateContent } from '../statusBar/content';
import { applyProgressVisibility, progressBarItem, updateProgress } from '../statusBar/progress';
import type { ReadingPrivacyPort } from '../../domain/books';
import { shouldShowStatusBarReading } from '../../config/settings';
import type { ReadingDisplayState } from './ReaderDisplayTypes';

export class StatusBarDisplay {
  constructor(private readonly privacyDisplay: ReadingPrivacyPort) {}

  render(state: ReadingDisplayState): void {
    if (!shouldShowStatusBarReading()) {
      this.hide();
      return;
    }

    updateContent(state.content, state.book, this.privacyDisplay);
    updateProgress(state.process, state.total, state.book, this.privacyDisplay);
    contentBarItem.show();
    applyProgressVisibility();
  }

  hide(): void {
    contentBarItem?.hide();
    progressBarItem?.hide();
  }
}
