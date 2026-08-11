import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../../config/constants';
import { Commands } from '../../config/commands';
import { applyReadingControlVisibility } from './index';
import { contentBarItem } from './content';
import { readingModeBarItem, codingModeBarItem } from './mode';
import { progressBarItem } from './progress';
import type { TxtReadingPort } from '../../domain/books';

export let stopBarItem: StatusBarItem;

export function setupStopBarItem(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  if (stopBarItem) {
    return;
  }

  stopBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Stop);
  stopBarItem.command = Commands.Stop;
  context.subscriptions.push(stopBarItem);
  stopBarItem.text = `$(debug-stop)`;
  stopBarItem.tooltip = 'Stop';
  stopBarItem.show();

  context.subscriptions.push(
    commands.registerCommand(Commands.Stop, () => {
      applyReadingControlVisibility(false);
      contentBarItem.hide();
      progressBarItem.hide();
      codingModeBarItem.show();
      readingModeBarItem.hide();
      void commands.executeCommand(Commands.SwitchCodingMode);
      reading.stopTxt();
    })
  );
}
