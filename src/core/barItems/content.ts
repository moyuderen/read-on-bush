
import { window } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';

export let contentBarItem: StatusBarItem;

export function updateContent(content: string) {
  contentBarItem.text = content;
  contentBarItem.tooltip = content;
}

export function setupContentBarItem(context: ExtensionContext) {
  if(contentBarItem) {
    return;
  }

  contentBarItem = window.createStatusBarItem();
  updateContent('Please select the book you want to read !');
  contentBarItem.show();
  context.subscriptions.push(contentBarItem);
}