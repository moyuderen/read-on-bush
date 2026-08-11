import { window, MarkdownString } from 'vscode';
import type { StatusBarItem, ExtensionContext } from 'vscode';
import type { BookData, ReadingPrivacyPort } from '../../domain/books';
import { getStatusBarPrefix } from '../../config/settings';

export let contentBarItem: StatusBarItem;

export function updateContent(
  content: string,
  book?: BookData,
  privacyDisplay?: ReadingPrivacyPort
): void {
  contentBarItem.text = `${getStatusBarPrefix()}${content}`;
  const mk = `
  |      |
  | :--- |
  | []() ${content} |
  `;
  const tooltip = new MarkdownString(mk, true);
  tooltip.supportHtml = true;
  tooltip.isTrusted = true;

  if (book && privacyDisplay) {
    tooltip.appendMarkdown(`\n\n---\n\n${privacyDisplay.getBookMessageName(book)}`);
  }

  contentBarItem.tooltip = tooltip;
}

export function setupContentBarItem(context: ExtensionContext): void {
  if (contentBarItem) {
    return;
  }

  contentBarItem = window.createStatusBarItem();
  updateContent('');
  context.subscriptions.push(contentBarItem);
}
