import type { ExtensionContext } from 'vscode';
// import { setupImportBarItem } from "./import";
import { readingModeBarItem, codingModeBarItem,  setupModeBarItem } from './mode';
import { setupContentBarItem } from './content';
import { setupPreLineBarItem } from './prevLine';
import { setupNextLineBarItem } from './nextLine';
import { setupJumpLineBarItem } from './jumpLine';
import { setupStartBarItem } from './start';
import { setupStopBarItem } from './stop';
import { setupProgressBarItem } from './progress';

export {
  readingModeBarItem,
  codingModeBarItem,
};

export function setupBars(context: ExtensionContext) {
  // setupImportBarItem(context);
  setupModeBarItem(context);
  setupContentBarItem(context);
  setupPreLineBarItem(context);
  setupNextLineBarItem(context);
  setupJumpLineBarItem(context);
  setupStartBarItem(context);
  setupStopBarItem(context);
  setupProgressBarItem(context);
}
