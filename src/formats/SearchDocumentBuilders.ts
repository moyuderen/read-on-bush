import type { EpubExtraction } from '../domain/books';
import type { SearchDocument } from '../domain/search';
import type { TxtSearchSegment } from '../infrastructure/parsers';

export function createTxtSearchDocument(
  bookId: string,
  segments: readonly TxtSearchSegment[]
): SearchDocument {
  return {
    bookId,
    format: 'txt',
    segments: segments.map((segment, index) => ({
      index,
      text: segment.text,
      separator: segment.separator,
      target: { kind: 'page', pageIndex: index }
    }))
  };
}

export function createEpubSearchDocument(
  bookId: string,
  extraction: EpubExtraction
): SearchDocument {
  return {
    bookId,
    format: 'epub',
    segments: extraction.chapters.map((chapter, index) => ({
      index,
      text: chapter.text,
      title: chapter.title,
      target: { kind: 'section', sectionIndex: index, offset: 0 }
    }))
  };
}
