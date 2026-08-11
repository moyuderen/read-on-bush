import { window, commands, StatusBarAlignment } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { StatusBarPriority } from '../../config/constants';
import { Commands } from '../../config/commands';
import { applyReadingControlVisibility } from './index';
import type { TxtReadingPort } from '../../domain/books';

export let startBarItem: StatusBarItem;

export function setupStartBarItem(
  context: ExtensionContext,
  reading: TxtReadingPort
): void {
  if (startBarItem) {
    return;
  }

  startBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Start);
  startBarItem.command = Commands.Start;
  context.subscriptions.push(startBarItem);
  startBarItem.text = `$(run)`;
  startBarItem.tooltip = 'Start';

  context.subscriptions.push(
    commands.registerCommand(Commands.Start, () => {
      applyReadingControlVisibility(true);
      reading.startTxt();
    })
  );
}
