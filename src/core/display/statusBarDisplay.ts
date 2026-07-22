import { contentBarItem, updateContent } from '../barItems/content';
import { applyProgressVisibility, progressBarItem, updateProgress } from '../barItems/progress';
import { shouldShowStatusBarReading } from '../settings';
import type { ReadingDisplayState } from './types';

export class StatusBarDisplay {
  render(state: ReadingDisplayState) {
    if (!shouldShowStatusBarReading()) {
      this.hide();
      return;
    }

    updateContent(state.content);
    updateProgress(state.process, state.total, state.book);
    contentBarItem.show();
    applyProgressVisibility();
  }

  hide() {
    contentBarItem?.hide();
    progressBarItem?.hide();
  }
}
