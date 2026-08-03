import {
  SAFE_SGR_CODE_ALTERNATION,
  STYLE_SGR_ENTRIES,
  type CustomTemplateLineStyle
} from './camouflageTemplates';
import { clearScreen, sanitizeTrustedTemplateContent } from './camouflageRender';

export type CamouflagePreviewSegment = {
  text: string;
  style: CustomTemplateLineStyle;
};

export type CamouflagePreviewLine = CamouflagePreviewSegment[];

// 由调色板单一事实源派生：安全 SGR 码 → 样式名。
const CODE_STYLE: Record<string, CustomTemplateLineStyle> = Object.fromEntries(
  STYLE_SGR_ENTRIES.map((entry) => [entry.code, entry.style])
);
const SGR_RE = new RegExp(`\\x1b\\[(${SAFE_SGR_CODE_ALTERNATION})m`, 'g');

export function terminalScreenToPreviewLines(screen: string): CamouflagePreviewLine[] {
  const content = screen.startsWith(clearScreen) ? screen.slice(clearScreen.length) : screen;
  return content.split('\r\n').map(parsePreviewLine);
}

function parsePreviewLine(line: string): CamouflagePreviewLine {
  const safeLine = sanitizeTrustedTemplateContent(line);
  const segments: CamouflagePreviewLine = [];
  let style: CustomTemplateLineStyle = 'plain';
  let index = 0;
  SGR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SGR_RE.exec(safeLine)) !== null) {
    appendSegment(segments, safeLine.slice(index, match.index), style);
    style = CODE_STYLE[match[1]] ?? 'plain';
    index = match.index + match[0].length;
  }
  appendSegment(segments, safeLine.slice(index), style);
  return segments.length > 0 ? segments : [{ text: '', style: 'plain' }];
}

function appendSegment(
  segments: CamouflagePreviewLine,
  text: string,
  style: CustomTemplateLineStyle
): void {
  if (!text) {
    return;
  }
  const previous = segments[segments.length - 1];
  if (previous?.style === style) {
    previous.text += text;
    return;
  }
  segments.push({ text, style });
}

