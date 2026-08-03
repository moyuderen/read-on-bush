import { getCharWidth } from './display/camouflageRender';
import type { EpubExtraction } from './parsers/EpubExtractor';
import type { EpubProgress } from './Book';

// epub 纯分页逻辑（无 VS Code 依赖，可单测）。
//
// 进度真相：{ chapterIndex, charOffset }，charOffset 是章节原始文本的字符偏移
// （含段落间的 \n），绑定源文本、不随 lineWidth 变化。
//
// 每次渲染时按当前有效 lineWidth 把章节折行，并记录每行的起始字符偏移；
// 于是“上一页/下一页”是同一折行数组上的下标算术，前后翻页完全对称、无跳页。

export type WrappedChapter = {
  lines: string[];
  // 每行在章节原始文本中的起始字符偏移（与 lines 等长）
  starts: number[];
};

export type Screen = {
  lines: string[];
};

type ChapterWrapper = (chapterIndex: number) => WrappedChapter;

export function wrapChapter(text: string, lineWidth: number): WrappedChapter {
  const safe = stripUnsafeTerminalControlsWithOffsets(text);
  const lines: string[] = [];
  const starts: number[] = [];

  let buffer = '';
  let width = 0;
  let lineStart = 0;

  const flush = (nextStart: number) => {
    if (buffer.length > 0) {
      lines.push(buffer);
      starts.push(lineStart);
    }
    buffer = '';
    width = 0;
    lineStart = nextStart;
  };

  for (let i = 0; i < safe.text.length; i++) {
    const ch = safe.text[i];
    const sourceOffset = safe.offsets[i];

    if (ch === '\n') {
      // 段落分隔：结束当前行，下一行从 \n 之后开始；连续 \n 不产生空行
      flush(sourceOffset + 1);
      continue;
    }

    const charWidth = getCharWidth(ch);

    if (width + charWidth > lineWidth && buffer.length > 0) {
      // 当前行已满：在此处断行，本字符归属下一行
      flush(sourceOffset);
    }

    buffer += ch;
    width += charWidth;
  }

  flush(text.length);

  return { lines, starts };
}

function stripUnsafeTerminalControlsWithOffsets(text: string): { text: string; offsets: number[] } {
  const result: string[] = [];
  const offsets: number[] = [];
  let i = 0;

  while (i < text.length) {
    if (text.startsWith('\x1b]', i)) {
      const nextBell = text.indexOf('\x07', i + 2);
      const nextSt = text.indexOf('\x1b\\', i + 2);
      const bellEnd = nextBell === -1 ? Number.POSITIVE_INFINITY : nextBell + 1;
      const stEnd = nextSt === -1 ? Number.POSITIVE_INFINITY : nextSt + 2;
      const end = Math.min(bellEnd, stEnd);

      if (Number.isFinite(end)) {
        i = end;
        continue;
      }
    }

    if (text.startsWith('\x1b[', i)) {
      const match = /\x1b\[[0-?]*[ -/]*[@-~]/.exec(text.slice(i));
      if (match?.index === 0) {
        i += match[0].length;
        continue;
      }
    }

    const ch = text[i];
    if (/^[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]$/.test(ch) && ch !== '\n') {
      i++;
      continue;
    }

    result.push(ch);
    offsets.push(i);
    i++;
  }

  return { text: result.join(''), offsets };
}

export function lineIndexForOffset(starts: number[], offset: number): number {
  // 最大的 i，使得 starts[i] <= offset
  let low = 0;
  let high = starts.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= offset) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

export function sameProgress(left: EpubProgress, right: EpubProgress): boolean {
  return left.chapterIndex === right.chapterIndex && left.charOffset === right.charOffset;
}

const MAX_TITLE_CHARS = 16;

function truncateChapterTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return '';
  }
  const chars = Array.from(trimmed);
  return chars.length > MAX_TITLE_CHARS ? `${chars.slice(0, MAX_TITLE_CHARS).join('')}…` : trimmed;
}

/**
 * 终端进度文案：章节标题 + 全书百分比。
 * 不再自行合成「第 N 章」——章号会因前置页（封面/版权/目录）而与书本身的编号错位，
 * 且书自己的标题往往已含章号（如「第 3 章」）。直接用 TOC 标题，终端与目录树就对得上。
 */
export function buildProgressLabel(
  extraction: EpubExtraction,
  progress: EpubProgress,
  chapterStartOffsets: readonly number[],
  totalChars: number,
  showChapterTitle = true
): string {
  const read = (chapterStartOffsets[progress.chapterIndex] ?? 0) + progress.charOffset;
  const percent = totalChars > 0 ? Math.round((read / totalChars) * 100) : 0;
  const clamped = Math.min(Math.max(percent, 0), 100);
  if (!showChapterTitle) {
    return `  全书 ${clamped}%`;
  }

  const { chapters } = extraction;
  const lastIndex = Math.max(chapters.length - 1, 0);
  const chapterIndex = Math.min(Math.max(progress.chapterIndex, 0), lastIndex);
  const chapter = chapters[chapterIndex];
  const title = chapter ? truncateChapterTitle(chapter.title) : '';
  const chapterPart = title || `第 ${chapterIndex + 1} 章`;
  return `  ${chapterPart} · 全书 ${clamped}%`;
}

/**
 * 从 progress 起取一屏（lineCount 行），可跨章自动流入；返回该屏内容与本屏结束位置
 * （= 下一屏的起点）。
 */
export function screenFrom(
  extraction: EpubExtraction,
  progress: EpubProgress,
  lineWidth: number,
  lineCount: number,
  getWrappedChapter: ChapterWrapper = (chapterIndex) =>
    wrapChapter(extraction.chapters[chapterIndex].text, lineWidth)
): { lines: string[]; endProgress: EpubProgress } {
  const { chapters } = extraction;
  const lines: string[] = [];

  let chapterIndex = Math.min(progress.chapterIndex, chapters.length - 1);
  let wrapped = getWrappedChapter(chapterIndex);
  let lineIndex = lineIndexForOffset(wrapped.starts, progress.charOffset);

  while (lines.length < lineCount) {
    while (lineIndex < wrapped.lines.length && lines.length < lineCount) {
      lines.push(wrapped.lines[lineIndex]);
      lineIndex++;
    }

    if (lines.length >= lineCount) {
      break;
    }

    chapterIndex++;
    if (chapterIndex >= chapters.length) {
      break;
    }

    wrapped = getWrappedChapter(chapterIndex);
    lineIndex = 0;
  }

  return { lines, endProgress: endProgressOf(extraction, chapterIndex, wrapped, lineIndex) };
}

function endProgressOf(
  extraction: EpubExtraction,
  chapterIndex: number,
  wrapped: WrappedChapter,
  lineIndex: number
): EpubProgress {
  const { chapters } = extraction;
  const lastChapter = chapters.length - 1;

  if (chapterIndex >= lastChapter && lineIndex >= wrapped.lines.length) {
    return { chapterIndex: lastChapter, charOffset: chapters[lastChapter].text.length };
  }

  if (lineIndex >= wrapped.lines.length) {
    return { chapterIndex: chapterIndex + 1, charOffset: 0 };
  }

  return { chapterIndex, charOffset: wrapped.starts[lineIndex] };
}

/**
 * 取 progress 之前的一屏（lineCount 行），返回该屏内容与它的起点。
 * 用于上一页：与下一页基于同一折行结果，完全对称。
 */
export function screenBefore(
  extraction: EpubExtraction,
  progress: EpubProgress,
  lineWidth: number,
  lineCount: number,
  getWrappedChapter: ChapterWrapper = (chapterIndex) =>
    wrapChapter(extraction.chapters[chapterIndex].text, lineWidth)
): { lines: string[]; startProgress: EpubProgress } {
  const { chapters } = extraction;
  const lines: string[] = [];

  let chapterIndex = Math.min(progress.chapterIndex, chapters.length - 1);
  let wrapped = getWrappedChapter(chapterIndex);
  let lineIndex = lineIndexForOffset(wrapped.starts, progress.charOffset);

  while (lines.length < lineCount) {
    while (lineIndex > 0 && lines.length < lineCount) {
      lineIndex--;
      lines.unshift(wrapped.lines[lineIndex]);
    }

    if (lines.length >= lineCount || chapterIndex === 0) {
      break;
    }

    chapterIndex--;
    wrapped = getWrappedChapter(chapterIndex);
    lineIndex = wrapped.lines.length;
  }

  if (lines.length === 0) {
    return { lines, startProgress: { chapterIndex: 0, charOffset: 0 } };
  }

  return { lines, startProgress: { chapterIndex, charOffset: wrapped.starts[lineIndex] } };
}

export function isEndOfBook(extraction: EpubExtraction, progress: EpubProgress): boolean {
  const { chapters } = extraction;
  const lastIndex = chapters.length - 1;
  return (
    progress.chapterIndex >= lastIndex &&
    progress.charOffset >= chapters[lastIndex].text.length
  );
}

/**
 * 下一屏的起点；若无下一屏（已到全书末尾或屏未变化）返回 undefined。
 * 关键：若当前屏的 endProgress 已到全书末尾，说明当前屏就是最后一屏，不再前进——
 * 避免末页（不足 lineCount 行的尾屏）之后还多翻一屏重复末行。
 */
export function nextScreenStart(
  extraction: EpubExtraction,
  progress: EpubProgress,
  lineWidth: number,
  lineCount: number,
  getWrappedChapter?: ChapterWrapper
): EpubProgress | undefined {
  const { endProgress } = screenFrom(extraction, progress, lineWidth, lineCount, getWrappedChapter);
  if (isEndOfBook(extraction, endProgress)) {
    return undefined;
  }
  if (sameProgress(endProgress, progress)) {
    return undefined;
  }
  return endProgress;
}
