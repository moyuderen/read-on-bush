import type { TerminalCamouflageStyle } from '../settings';

// 共享的纯视觉原语：日志模板、折行、宽度计算、拼屏。
// txt 终端伪装与 epub 终端伪装都调用本模块——日志长相只有一份，改样式只改这里。
// 注意：本模块只负责“画成什么样”，不涉及分页/进度（那些是各自格式自己的逻辑）。

export const clearScreen = '\x1b[2J\x1b[H';
export const minContentWidth = 20;
export const fallbackContentWidth = 80;

export type TerminalTemplate = {
  contentPrefix: string;
  header: string[];
  trailing: string[];
  done: (progress: string) => string;
  footer: string;
};

export function getTemplate(style: TerminalCamouflageStyle): TerminalTemplate {
  if (style === 'claudeCli') {
    return {
      contentPrefix: '  ⎿  ',
      header: [
        'claude',
        '',
        '✻ Thinking…',
        '⎿  Read src/core/display/terminalCamouflageDisplay.ts',
        '⎿  Read src/core/settings.ts',
        '⎿  Search(pattern: "terminalCamouflage", path: "src")',
        '⎿  Update Todos',
        '',
        '● I’ll keep the display state centralized and update the terminal renderer next.',
        '',
        '✢ Processing…',
        ''
      ],
      trailing: [
        '',
        '⎿  Modified src/core/display/terminalCamouflageDisplay.ts',
        '⎿  Running npm run compile',
        '⎿  Running npm run lint'
      ],
      done: (progress) => `● Update complete${progress}`,
      footer: 'esc to interrupt · n/p step · j jump · q stop'
    };
  }

  if (style === 'serverLog') {
    return {
      contentPrefix: 'INFO  ',
      header: [
        'npm run dev',
        '',
        'INFO  Server listening on http://localhost:3000',
        'INFO  Loaded env from .env.local',
        'INFO  Connected to local workspace cache',
        'INFO  GET /api/workspaces 200 14ms',
        'INFO  GET /api/projects/current 200 18ms',
        'INFO  cache warmed in 38ms',
        'DEBUG requestId=req_42f8 route=/api/runtime/status',
        ''
      ],
      trailing: [
        '',
        'DEBUG requestId=req_42f8 normalized payload in 3ms',
        'INFO  POST /api/runtime/events 202 9ms',
        'INFO  background worker heartbeat ok'
      ],
      done: (progress) => `INFO  request completed${progress}`,
      footer: 'Press n/p to step, j to jump, q to stop.'
    };
  }

  return {
    contentPrefix: '[12:42:13] info  ',
    header: [
      '> npm run watch',
      '',
      '[12:41:07] Starting compilation in watch mode...',
      '[12:41:08] File change detected. Starting incremental compilation...',
      '[12:41:08] Found 0 errors. Watching for file changes.',
      '',
      'assets by status 128 KiB [cached] 14 assets',
      'runtime modules 3.12 KiB 6 modules',
      'orphan modules 9.61 KiB [orphan] 4 modules',
      'cacheable modules 48.7 KiB',
      '  ./src/extension.ts 2.18 KiB [built] [code generated]',
      '  ./src/index.ts 1.67 KiB [built] [code generated]',
      ''
    ],
    trailing: [
      '',
      '[12:42:21] info  emitted 4 files to out/',
      '[12:42:21] info  asset extension.js 42.1 KiB [emitted]',
      '[12:42:22] info  watching for file changes...'
    ],
    done: (progress) => `[12:42:59] done  compiled successfully${progress}`,
    footer: 'Press n/p to step, j to jump, q to stop.'
  };
}

export function sanitizeContent(content: string): string {
  return content
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t\f\v 　]+/g, ' ')
    .trim();
}

export function getCharWidth(char: string): number {
  return /[^\x00-\xff]/.test(char) ? 2 : 1;
}

export function getTextWidth(text: string): number {
  return Array.from(text).reduce((width, char) => width + getCharWidth(char), 0);
}

export function splitContent(content: string, lineWidth: number): string[] {
  const sanitized = sanitizeContent(content);

  if (!sanitized) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const char of Array.from(sanitized)) {
    const charWidth = getCharWidth(char);

    if (currentWidth + charWidth > lineWidth) {
      lines.push(currentLine.trim());
      currentLine = char;
      currentWidth = charWidth;
      continue;
    }

    currentLine += char;
    currentWidth += charWidth;
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

export function formatTerminalIdleScreen(style: TerminalCamouflageStyle = 'buildLog'): string {
  const template = getTemplate(style);
  const lines = [...template.header, ...template.trailing, template.done('')];

  return `${clearScreen}${lines.join('\r\n')}`;
}

/**
 * 共享的拼屏原语：给定已经分页好的正文行 + 已经格式化好的进度文案，
 * 套上日志模板拼成一屏。txt 和 epub 都调它——这就是“视觉长相只有一份”。
 */
export function formatCamouflageScreen(
  style: TerminalCamouflageStyle,
  contentLines: string[],
  progressLabel: string
): string {
  const template = getTemplate(style);
  const indent = ' '.repeat(template.contentPrefix.length);
  const lines = [
    ...template.header,
    ...contentLines.map((content, index) => `${index === 0 ? template.contentPrefix : indent}${content}`),
    ...template.trailing,
    template.done(progressLabel),
    '',
    template.footer
  ];

  return `${clearScreen}${lines.join('\r\n')}`;
}

/**
 * 有效正文宽度：综合配置值、终端列数与当前样式前缀宽度。
 * txt 终端与 epub 终端共用同一套计算。
 */
export function computeEffectiveLineWidth(
  lineWidth: number,
  columns: number | undefined,
  style: TerminalCamouflageStyle
): number {
  const template = getTemplate(style);
  const terminalContentWidth = columns
    ? columns - template.contentPrefix.length - 2
    : fallbackContentWidth;
  const maxContentWidth = Math.max(minContentWidth, terminalContentWidth);

  if (lineWidth <= 0) {
    return maxContentWidth;
  }

  return Math.max(minContentWidth, Math.min(lineWidth, maxContentWidth));
}
