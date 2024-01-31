
import { window, MarkdownString } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { app } from '../index';

export let contentBarItem: StatusBarItem;

export function updateContent(content: string) {
  contentBarItem.text = content;
  // contentBarItem.tooltip = content;
  // 需要 [链接](http://) 来块化tooltip, 起到hover不隐藏的目的
  const mk = ` 
  |      |
  | :--- |
  | []() ${content} |
  `;
  const tooltip = new MarkdownString(mk, true);
  tooltip.supportHtml = true;
  tooltip.isTrusted = true;

  if(app && app.readingBook) {
    tooltip.appendMarkdown(`\n\n---\n\n《${app.readingBook.book.name}》`);
  }

  contentBarItem.tooltip = tooltip;
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