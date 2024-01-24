import type { ExtensionContext } from 'vscode';
import { importBarItem,  setupImportBarItem } from "./import";
import { readingModeBarItem, codingModeBarItem,  setupModeBarItem } from './mode';
import { setupContentBarItem } from './content';
import { setupPreLineBarItem } from './prevLine';
import { setupNextLineBarItem } from './nextLine';
import { setupStartBarItem } from './start';
import { setupStopBarItem } from './stop';
import { setupProgressBarItem } from './progress';

export {
  importBarItem,
  readingModeBarItem,
  codingModeBarItem,
};

export function setupBars(context: ExtensionContext) {
  setupImportBarItem(context);
  setupModeBarItem(context);
  setupContentBarItem(context);
  setupPreLineBarItem(context);
  setupNextLineBarItem(context);
  setupStartBarItem(context);
  setupStopBarItem(context);
  setupProgressBarItem(context);
}
