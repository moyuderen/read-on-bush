import type { BookNavigationTarget } from '../books';

export type SearchDocumentFormat = 'txt' | 'epub';

export type SearchSegment = {
  index: number;
  text: string;
  title?: string;
  /** 与下一分段之间的逻辑分隔符；TXT 的显示切片没有真实分隔符。 */
  separator?: string;
  target: BookNavigationTarget;
};

export type SearchDocument = {
  bookId: string;
  format: SearchDocumentFormat;
  segments: SearchSegment[];
};

export type SearchMatch = {
  segmentIndex: number;
  startOffset: number;
  length: number;
  preview: string;
  target: BookNavigationTarget;
};

export type SearchPage = {
  matches: SearchMatch[];
  nextOffset: number;
  hasMore: boolean;
};
