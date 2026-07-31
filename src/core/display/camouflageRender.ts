import type { TerminalCamouflageStyle } from '../settings';
import { createBuiltinTemplates } from './camouflageTemplates';
import { KEYS_HINT } from './camouflageTemplates/keys';
import type { TerminalTemplate } from './camouflageTemplates';
export { KEYS_HINT } from './camouflageTemplates/keys';

// 共享的纯视觉原语：日志模板、折行、宽度计算、拼屏。
// txt 终端伪装与 epub 终端伪装都调用本模块——日志长相只有一份，改样式只改这里。
// 注意：本模块只负责“画成什么样”，不涉及分页/进度（那些是各自格式自己的逻辑）。

export const clearScreen = '\x1b[2J\x1b[H';
export const minContentWidth = 20;
export const fallbackContentWidth = 80;

export type TerminalCamouflageContentMode = 'real' | 'debugTemplate';

const builtinTemplates: Record<TerminalCamouflageStyle, TerminalTemplate> = createBuiltinTemplates({
  fallbackContentWidth,
  getTextWidth,
  fitLineToWidth,
  joinLeftAndRight
});

export function getTemplate(style: TerminalCamouflageStyle): TerminalTemplate {
  return builtinTemplates[style];
}

export function getTerminalName(style: TerminalCamouflageStyle): string {
  return getTemplate(style).terminalName;
}

export function formatTerminalTitle(style: TerminalCamouflageStyle): string {
  return `\x1b]0;${getTerminalName(style)}\x07`;
}

export function updateTerminalStyle(
  currentStyle: TerminalCamouflageStyle,
  nextStyle: TerminalCamouflageStyle,
  writeTitle?: (title: string) => void
): TerminalCamouflageStyle {
  if (currentStyle !== nextStyle) {
    writeTitle?.(formatTerminalTitle(nextStyle));
  }

  return nextStyle;
}

const wrappedDebugLinesCache = new Map<string, string[]>();

export function sanitizeContent(content: string): string {
  return stripUnsafeTerminalControls(content)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t\f\v 　]+/g, ' ')
    .trim();
}

export function getCharWidth(char: string): number {
  return /[^\x00-\xff]/.test(char) ? 2 : 1;
}

export function getTextWidth(text: string): number {
  return Array.from(stripUnsafeTerminalControls(text)).reduce((width, char) => width + getCharWidth(char), 0);
}

export function splitContent(content: string, lineWidth: number): string[] {
  return splitSanitizedContent(sanitizeContent(content), lineWidth);
}

function splitTrustedTemplateContent(content: string, lineWidth: number): string[] {
  return splitSanitizedContent(sanitizeTrustedTemplateContent(content), lineWidth);
}

function splitSanitizedContent(content: string, lineWidth: number): string[] {
  if (!content) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  let index = 0;

  while (index < content.length) {
    const sgr = readAnsiSgrAt(content, index);
    if (sgr) {
      currentLine += sgr;
      index += sgr.length;
      continue;
    }

    const codePoint = content.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const char = String.fromCodePoint(codePoint);
    const charWidth = getCharWidth(char);

    if (currentWidth + charWidth > lineWidth) {
      lines.push(currentLine.trim());
      currentLine = char;
      currentWidth = charWidth;
      index += char.length;
      continue;
    }

    currentLine += char;
    currentWidth += charWidth;
    index += char.length;
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

function readAnsiSgrAt(content: string, index: number): string | undefined {
  if (content.charCodeAt(index) !== 0x1b || content[index + 1] !== '[') {
    return undefined;
  }

  const match = /^\x1b\[(?:0|2|31|32|33|34|35|36)m/.exec(content.slice(index));
  return match?.[0];
}

export function getDebugContentLines(
  style: TerminalCamouflageStyle,
  lineWidth: number,
  lineCount: number
): string[] {
  return ensureLineCount(
    getWrappedDebugContentLines(style, lineWidth),
    Math.max(lineCount, 1)
  );
}

export function formatDebugCamouflageScreen(
  style: TerminalCamouflageStyle,
  lineWidth: number,
  lineCount: number,
  columns?: number
): string {
  return formatCamouflageScreenInternal(
    style,
    getDebugContentLines(style, lineWidth, lineCount),
    '',
    columns,
    sanitizeTrustedTemplateContent
  );
}

export function formatTerminalIdleScreen(style: TerminalCamouflageStyle = 'buildLog'): string {
  const template = getTemplate(style);
  const lines = [...template.header, ...template.trailing, template.done('')];

  return `${clearScreen}${lines.join('\r\n')}`;
}

/**
 * 共享的拼屏原语：给定已经分页好的正文行 + 已经格式化好的进度文案，
 * 套上日志模板拼成一屏。txt 和 epub 都调它——这就是“视觉长相只有一份”。
 * columns 透传给模板底部区块，用于需要自适应排版的模版。
 * 普通模版使用默认底部区块，特殊模版可以完全接管底部内容。
 */
export function formatCamouflageScreen(
  style: TerminalCamouflageStyle,
  contentLines: string[],
  progressLabel: string,
  columns?: number
): string {
  return formatCamouflageScreenInternal(
    style,
    contentLines,
    progressLabel,
    columns,
    stripUnsafeTerminalControls
  );
}

function formatCamouflageScreenInternal(
  style: TerminalCamouflageStyle,
  contentLines: string[],
  progressLabel: string,
  columns: number | undefined,
  sanitizeLine: (content: string) => string
): string {
  const template = getTemplate(style);
  const indent = ' '.repeat(template.contentPrefix.length);
  const progress = stripUnsafeTerminalControls(progressLabel);
  const bottomLines = template.bottom?.(progress, columns) ?? [
    template.done(progress, columns),
    '',
    KEYS_HINT
  ];

  const lines = [
    ...template.header,
    ...contentLines.map((content, index) =>
      `${index === 0 ? template.contentPrefix : indent}${sanitizeLine(content)}`
    ),
    ...template.trailing,
    ...bottomLines
  ];

  return `${clearScreen}${lines.join('\r\n')}`;
}

/**
 * 有效正文宽度：综合配置值、终端列数与当前样式前缀宽度。
 * 前缀宽度直接取自模版，不再另存一份。
 */
export function computeEffectiveLineWidth(
  lineWidth: number,
  columns: number | undefined,
  style: TerminalCamouflageStyle
): number {
  const prefixLength = getTemplate(style).contentPrefix.length;
  const terminalContentWidth = columns
    ? columns - prefixLength - 2
    : fallbackContentWidth;
  const maxContentWidth = Math.max(minContentWidth, terminalContentWidth);

  if (lineWidth <= 0) {
    return maxContentWidth;
  }

  return Math.max(minContentWidth, Math.min(lineWidth, maxContentWidth));
}

function joinLeftAndRight(left: string, right: string, width: number): string {
  const fittedLeft = fitLineToWidth(left, width);
  const leftWidth = getTextWidth(fittedLeft);
  const remainingWidth = width - leftWidth;
  if (remainingWidth <= 1) {
    return fittedLeft;
  }

  const fittedRight = fitLineToWidth(right, remainingWidth - 1);
  const rightWidth = getTextWidth(fittedRight);
  const gap = Math.max(1, width - leftWidth - rightWidth);
  return `${fittedLeft}${' '.repeat(gap)}${fittedRight}`;
}

function fitLineToWidth(content: string, width: number): string {
  if (width <= 0) {
    return '';
  }

  let result = '';
  let currentWidth = 0;

  for (const char of Array.from(content)) {
    const charWidth = getCharWidth(char);
    if (currentWidth + charWidth > width) {
      break;
    }

    result += char;
    currentWidth += charWidth;
  }

  return result;
}

function getWrappedDebugContentLines(style: TerminalCamouflageStyle, lineWidth: number): string[] {
  const width = Math.max(lineWidth, minContentWidth);
  const cacheKey = `${style}:${width}`;
  const cachedLines = wrappedDebugLinesCache.get(cacheKey);

  if (cachedLines) {
    return cachedLines;
  }

  const lines = getTemplate(style).debugContent.flatMap((line) => splitTrustedTemplateContent(line, width));
  wrappedDebugLinesCache.set(cacheKey, lines);
  return lines;
}

function ensureLineCount(lines: string[], lineCount: number): string[] {
  if (lines.length >= lineCount) {
    return lines.slice(0, lineCount);
  }

  const padded = [...lines];
  const source = lines.length > 0 ? lines : [''];
  while (padded.length < lineCount) {
    padded.push(source[padded.length % source.length]);
  }
  return padded;
}

const OSC_SEQUENCE_RE = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g;
const ALL_CSI_SEQUENCE_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const UNSAFE_TEMPLATE_CSI_SEQUENCE_RE = /\x1b\[(?!(?:0|2|31|32|33|34|35|36)m)[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
const TRUSTED_TEMPLATE_CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1a\x1c-\x1f\x7f-\x9f]/g;

function stripTerminalControls(content: string, csiPattern: RegExp, controlPattern: RegExp): string {
  return content
    .replace(OSC_SEQUENCE_RE, '')
    .replace(csiPattern, '')
    .replace(controlPattern, '');
}

function sanitizeTrustedTemplateContent(content: string): string {
  return stripTerminalControls(content, UNSAFE_TEMPLATE_CSI_SEQUENCE_RE, TRUSTED_TEMPLATE_CONTROL_CHARS_RE);
}

function stripUnsafeTerminalControls(content: string): string {
  return stripTerminalControls(content, ALL_CSI_SEQUENCE_RE, CONTROL_CHARS_RE);
}
