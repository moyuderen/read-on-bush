import type { BookData, ReadingPrivacyPort } from '../../domain/books';
import { getBookGroupName } from '../../config/bookGroups';
import type { BookListGroupBy } from '../../config/settings';

export type BookGroupDescriptor = {
  key: string;
  name: string;
  rawName: string;
};

export function getBookGroupDescriptor(
  book: BookData,
  groupBy: BookListGroupBy,
  privacyDisplay: ReadingPrivacyPort
): BookGroupDescriptor {
  const rawName = getBookGroupName(book, groupBy);
  const name = privacyDisplay.isPrivate
    ? groupBy === 'directory'
      ? '本地文档'
      : groupBy === 'category'
        ? '文档'
        : rawName
    : rawName;
  return {
    key: name,
    name,
    rawName
  };
}
