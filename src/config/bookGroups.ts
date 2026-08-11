import path from 'path';
import { type BookData } from '../domain/books';
import { type BookListGroupBy } from './settings';

export const uncategorizedBookGroupName = '未分类';

export function getBookGroupName(book: BookData, groupBy: BookListGroupBy): string {
  if (groupBy === 'category') {
    return book.category || uncategorizedBookGroupName;
  }

  if (groupBy === 'directory') {
    return path.dirname(book.url);
  }

  return '';
}
