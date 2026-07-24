import { window, MarkdownString } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import { app } from '../index';
import { getStatusBarPrefix } from '../settings';

export let contentBarItem: StatusBarItem;

function getCurrentContent(): string {
  const readingBook = app && app.readingBook;

  if (!readingBook) {
    return '';
  }

  return readingBook.contents[readingBook.book.process] || '';
}

export function updateContent(content: string) {
  contentBarItem.text = `${getStatusBarPrefix()}${content}`;
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

  if (app && app.readingBook) {
    tooltip.appendMarkdown(`\n\n---\n\n《${app.readingBook.book.name}》`);
  }

  contentBarItem.tooltip = tooltip;
}

export function refreshContentBarItem() {
  updateContent(getCurrentContent());
}

export function setupContentBarItem(context: ExtensionContext) {
  if (contentBarItem) {
    return;
  }

  contentBarItem = window.createStatusBarItem();
  updateContent('');

  context.subscriptions.push(contentBarItem);
}
