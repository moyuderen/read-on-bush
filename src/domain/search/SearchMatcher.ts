import type { BookNavigationTarget } from '../books';
import type { SearchDocument, SearchMatch, SearchPage, SearchSegment } from './SearchDocument';

const DEFAULT_CONTEXT_LENGTH = 30;
const CJK_CHAR_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
const CJK_OPENING_PUNCTUATION = new Set(Array.from('（《【『「“‘'));
const CJK_CLOSING_PUNCTUATION = new Set(Array.from('，。！？；：、）》】』」”’…'));
const CJK_PUNCTUATION = new Set([
  ...Array.from(CJK_OPENING_PUNCTUATION),
  ...Array.from(CJK_CLOSING_PUNCTUATION)
]);

type NormalizedText = {
  text: string;
  map: number[];
};

export type SearchIndex = {
  document: SearchDocument;
  text: string;
  map: number[];
  segmentStarts: number[];
};

type Token = {
  value: string;
  sourceOffset: number;
};

export function createSearchIndex(document: SearchDocument): SearchIndex {
  const segmentStarts: number[] = [];
  let sourceOffset = 0;
  for (let index = 0; index < document.segments.length; index++) {
    segmentStarts.push(sourceOffset);
    const segment = document.segments[index];
    sourceOffset += segment.text.length;
    if (index < document.segments.length - 1) {
      sourceOffset += (segment.separator ?? '\n').length;
    }
  }

  const normalized = buildSearchText(document.segments);
  return { document, text: normalized.text, map: normalized.map, segmentStarts };
}

export function searchDocument(
  document: SearchDocument,
  query: string,
  limit: number,
  startOffset = 0
): SearchPage {
  return searchIndex(createSearchIndex(document), query, limit, startOffset);
}

export function searchIndex(
  index: SearchIndex,
  query: string,
  limit: number,
  startOffset = 0
): SearchPage {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || limit <= 0) {
    return { matches: [], nextOffset: 0, hasMore: false };
  }

  const matches: SearchMatch[] = [];
  let cursor = Math.max(startOffset, 0);

  while (matches.length < limit) {
    const matchOffset = index.text.indexOf(normalizedQuery, cursor);
    if (matchOffset < 0) {
      return { matches, nextOffset: index.text.length, hasMore: false };
    }

    const sourceStart = index.map[matchOffset] ?? 0;
    const sourceEnd = index.map[Math.min(matchOffset + normalizedQuery.length - 1, index.map.length - 1)] ?? sourceStart;
    const resolved = resolveSourceOffset(index, sourceStart);

    if (resolved) {
      const segment = index.document.segments[resolved.segmentIndex];
      matches.push({
        segmentIndex: resolved.segmentIndex,
        startOffset: resolved.offset,
        length: Math.max(sourceEnd - sourceStart + 1, 1),
        preview: createPreview(segment.text, resolved.offset),
        target: offsetTarget(segment.target, resolved.offset)
      });
    }

    cursor = matchOffset + Math.max(normalizedQuery.length, 1);
  }

  return {
    matches,
    nextOffset: cursor,
    hasMore: index.text.indexOf(normalizedQuery, cursor) >= 0
  };
}

export function normalizeSearchText(text: string): string {
  return normalizeSearchTextWithMap(text).text;
}

export function createPreview(text: string, matchOffset: number, contextLength = DEFAULT_CONTEXT_LENGTH): string {
  const start = Math.max(0, matchOffset - contextLength);
  const end = Math.min(text.length, matchOffset + contextLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function buildSearchText(segments: SearchSegment[]): NormalizedText {
  const parts: string[] = [];
  segments.forEach((segment, index) => {
    parts.push(segment.text);
    if (index < segments.length - 1) {
      parts.push(segment.separator ?? '\n');
    }
  });
  return normalizeSearchTextWithMap(parts.join(''));
}

function normalizeSearchTextWithMap(text: string): NormalizedText {
  const tokens: Token[] = [];
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const value = String.fromCodePoint(codePoint).normalize('NFKC');
    if (value !== String.fromCharCode(0x00ad)) {
      for (const normalizedChar of Array.from(value)) {
        for (let offset = 0; offset < normalizedChar.length; offset++) {
          tokens.push({ value: normalizedChar, sourceOffset: index });
        }
      }
    }
    index += codePoint > 0xffff ? 2 : 1;
  }

  const output: string[] = [];
  const map: number[] = [];
  let index = 0;
  let previousNonSpace = '';

  while (index < tokens.length) {
    if (!isSpaceToken(tokens[index].value)) {
      appendToken(output, map, tokens[index]);
      previousNonSpace = tokens[index].value;
      index++;
      continue;
    }

    const runStart = index;
    while (index < tokens.length && isSpaceToken(tokens[index].value)) {
      index++;
    }
    const nextNonSpace = tokens[index]?.value ?? '';

    // PDF/EPUB 断词：把行尾的英文连字符和换行合并掉。
    if (previousNonSpace === '-' && /^[A-Za-z0-9]$/.test(nextNonSpace)) {
      removeLastToken(output, map);
      previousNonSpace = output.length > 0 ? output[output.length - 1] : '';
      continue;
    }

    if (shouldDropSpace(previousNonSpace, nextNonSpace)) {
      continue;
    }

    output.push(' ');
    map.push(tokens[runStart].sourceOffset);
  }

  return { text: output.join(''), map };
}

function appendToken(output: string[], map: number[], token: Token): void {
  output.push(token.value);
  for (let index = 0; index < token.value.length; index++) {
    map.push(token.sourceOffset);
  }
}

function removeLastToken(output: string[], map: number[]): void {
  const removed = output.pop();
  if (removed) {
    map.splice(Math.max(0, map.length - removed.length), removed.length);
  }
}

function isSpaceToken(value: string): boolean {
  return /^\s$/u.test(value);
}

function shouldDropSpace(previous: string, next: string): boolean {
  if (!next) {
    return false;
  }
  if (previous && CJK_OPENING_PUNCTUATION.has(previous)) {
    return true;
  }
  if (CJK_CLOSING_PUNCTUATION.has(next)) {
    return true;
  }
  if (previous && (CJK_CHAR_RE.test(previous) || CJK_PUNCTUATION.has(previous)) && CJK_OPENING_PUNCTUATION.has(next)) {
    return true;
  }
  if (previous && CJK_CHAR_RE.test(previous) && CJK_CHAR_RE.test(next)) {
    return true;
  }
  if (previous && CJK_PUNCTUATION.has(previous) && CJK_CHAR_RE.test(next)) {
    return true;
  }
  return false;
}

function resolveSourceOffset(
  index: SearchIndex,
  sourceOffset: number
): { segmentIndex: number; offset: number } | undefined {
  const { document, segmentStarts } = index;
  if (segmentStarts.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = segmentStarts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (segmentStarts[middle] <= sourceOffset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const segmentIndex = Math.max(0, low - 1);
  const segment = document.segments[segmentIndex];
  return {
    segmentIndex,
    offset: Math.min(Math.max(sourceOffset - segmentStarts[segmentIndex], 0), segment.text.length)
  };
}

function offsetTarget(target: BookNavigationTarget, offset: number): BookNavigationTarget {
  if (target.kind === 'section' || target.kind === 'page') {
    return { ...target, offset: (target.offset ?? 0) + offset };
  }
  return target;
}
