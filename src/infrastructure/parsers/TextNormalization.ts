// 阅读文本归一化：清理 PDF / 转换版 EPUB 常见的中文排版空格噪声。
// 只删除 CJK 文本与中文标点之间的横向空白，不动英文单词间空格。

export type NormalizedTextWithOffsetMap = {
  text: string;
  mapOffset: (offset: number) => number;
};

const CJK_CHAR_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]$/u;
const CJK_OPENING_PUNCTUATION = new Set(Array.from('（《【『「“‘'));
const CJK_CLOSING_PUNCTUATION = new Set(Array.from('，。！？；：、）》】』」”’…'));
const CJK_PUNCTUATION = new Set([
  ...Array.from(CJK_OPENING_PUNCTUATION),
  ...Array.from(CJK_CLOSING_PUNCTUATION)
]);

export function normalizeCjkSpacing(text: string): string {
  return normalizeCjkSpacingWithOffsetMap(text).text;
}

export function normalizeCjkSpacingWithOffsetMap(text: string): NormalizedTextWithOffsetMap {
  const oldToNew = new Array<number>(text.length + 1);
  let result = '';
  let index = 0;
  let previousNonSpace = '';

  while (index < text.length) {
    oldToNew[index] = result.length;
    const char = readCodePointAt(text, index);

    if (isHorizontalSpace(char.value)) {
      const runStart = index;
      let runEnd = index + char.length;
      while (runEnd < text.length) {
        const nextSpace = readCodePointAt(text, runEnd);
        if (!isHorizontalSpace(nextSpace.value)) {
          break;
        }
        runEnd += nextSpace.length;
      }

      const nextNonSpace = readNextNonHorizontalSpace(text, runEnd);
      if (shouldDropHorizontalSpace(previousNonSpace, nextNonSpace)) {
        fillOffsetMap(oldToNew, runStart, runEnd, result.length);
        index = runEnd;
        continue;
      }

      const kept = text.slice(runStart, runEnd);
      fillKeptOffsetMap(oldToNew, runStart, runEnd, result.length);
      result += kept;
      index = runEnd;
      continue;
    }

    fillKeptOffsetMap(oldToNew, index, index + char.length, result.length);
    result += char.value;
    previousNonSpace = char.value;
    index += char.length;
  }

  oldToNew[text.length] = result.length;

  return {
    text: result,
    mapOffset(offset: number): number {
      const clamped = Math.min(Math.max(Math.floor(offset), 0), text.length);
      return oldToNew[clamped] ?? result.length;
    }
  };
}

function shouldDropHorizontalSpace(previous: string, next: string): boolean {
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

function isHorizontalSpace(char: string): boolean {
  return char === ' ' || char === '\t';
}

function readNextNonHorizontalSpace(text: string, start: number): string {
  let index = start;
  while (index < text.length) {
    const char = readCodePointAt(text, index);
    if (!isHorizontalSpace(char.value)) {
      return char.value;
    }
    index += char.length;
  }
  return '';
}

function readCodePointAt(text: string, index: number): { value: string; length: number } {
  const codePoint = text.codePointAt(index);
  if (codePoint === undefined) {
    return { value: '', length: 0 };
  }
  const value = String.fromCodePoint(codePoint);
  return { value, length: value.length };
}

function fillOffsetMap(map: number[], start: number, end: number, value: number): void {
  for (let i = start; i <= end; i++) {
    map[i] = value;
  }
}

function fillKeptOffsetMap(map: number[], start: number, end: number, outputStart: number): void {
  for (let i = start; i <= end; i++) {
    map[i] = outputStart + i - start;
  }
}
