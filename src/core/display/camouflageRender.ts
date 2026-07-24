import type { TerminalCamouflageStyle } from '../settings';

// 共享的纯视觉原语：日志模板、折行、宽度计算、拼屏。
// txt 终端伪装与 epub 终端伪装都调用本模块——日志长相只有一份，改样式只改这里。
// 注意：本模块只负责“画成什么样”，不涉及分页/进度（那些是各自格式自己的逻辑）。

export const clearScreen = '\x1b[2J\x1b[H';
export const minContentWidth = 20;
export const fallbackContentWidth = 80;

// Claude Code 代码 diff 的 ANSI 配色：增/删/块头/弱化上下文。
const DIFF_GREEN = '\x1b[32m';
const DIFF_RED = '\x1b[31m';
const DIFF_CYAN = '\x1b[36m';
const DIFF_DIM = '\x1b[2m';
const DIFF_RESET = '\x1b[0m';

// 各样式的正文行前缀：单一事实源，getTemplate 与 computeEffectiveLineWidth 共用，
// 避免为了读一个 contentPrefix.length 就重建整份模板。
const contentPrefixByStyle: Record<TerminalCamouflageStyle, string> = {
  buildLog: '[12:42:13] info  ',
  claudeCli: '',
  serverLog: 'INFO  '
};

export type TerminalTemplate = {
  contentPrefix: string;
  header: string[];
  trailing: string[];
  done: (progress: string) => string;
  footer: (columns?: number) => string;
};

export function getTemplate(style: TerminalCamouflageStyle): TerminalTemplate {
  if (style === 'claudeCli') {
    return {
      // Claude Code 的真实输出主体通常没有固定行前缀；正文直接像助手回复一样铺开。
      contentPrefix: contentPrefixByStyle.claudeCli,
      header: [
        '✻ Planning…',
        '  ⎿  Read src/features/orders/OrderList.tsx',
        '  ⎿  Read src/api/orders.ts',
        '  ⎿  Grep(pattern: "useInfiniteQuery", path: "src")',
        '',
        '方案如下，确认后我就开始：',
        '  1. 订单列表接上分页接口，滚到底自动加载下一页',
        '  2. 补 loading / 空状态 / 失败重试',
        '  3. 加单测并跑一遍 lint',
        ''
      ],
      trailing: [
        '',
        '✏️  Updated src/api/orders.ts',
        `     ${DIFF_CYAN}@@ -24,7 +24,10 @@${DIFF_RESET}`,
        `   ${DIFF_RED}-  const res = await fetch('/api/orders')${DIFF_RESET}`,
        `   ${DIFF_GREEN}+  const res = await fetch('/api/orders?page=' + page + '&size=20')${DIFF_RESET}`,
        `   ${DIFF_GREEN}+  if (!res.ok) throw new Error('订单加载失败')${DIFF_RESET}`,
        '',
        `● ${DIFF_DIM}npm test${DIFF_RESET}  ${DIFF_GREEN}✓${DIFF_RESET} 18 passed (2.4s)`,
        ''
      ],
      done: (progress) => `* Sautéed for 8m 6s${progress ? ` · ${progress}` : ''}`,
      footer: formatClaudeCliFooter
    };
  }

  if (style === 'serverLog') {
    return {
      contentPrefix: contentPrefixByStyle.serverLog,
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
      footer: () => 'Press n/p to step, j to jump, q to stop.'
    };
  }

  return {
    contentPrefix: contentPrefixByStyle.buildLog,
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
    footer: () => 'Press n/p to step, j to jump, q to stop.'
  };
}

/**
 * Claude Code CLI 的底部输入框/状态栏。分隔线与右对齐提示按终端列数自适应，
 * 不再写死长度——终端宽窄变化时也能铺满，伪装性更强。
 */
function formatClaudeCliFooter(columns?: number): string {
  const width = columns && columns > 0 ? columns : fallbackContentWidth;
  const divider = '─'.repeat(width);
  const hint = 'new task? /clear to save 308.4k tokens';
  return [
    hint.padStart(width),
    divider,
    '›',
    divider,
    '[opus-4.8[1m]] ██████░░░░░░░░ 30% | 💰 $16.17 | ⏱ 305m 44s',
    '▸▸ accept edits on (shift+tab to cycle) · n/p step · j jump · q stop'
  ].join('\r\n');
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
 * columns 透传给 footer（仅 claudeCli 用到，用于自适应分隔线宽度）。
 */
export function formatCamouflageScreen(
  style: TerminalCamouflageStyle,
  contentLines: string[],
  progressLabel: string,
  columns?: number
): string {
  const template = getTemplate(style);
  const indent = ' '.repeat(template.contentPrefix.length);
  const lines = [
    ...template.header,
    ...contentLines.map((content, index) => `${index === 0 ? template.contentPrefix : indent}${content}`),
    ...template.trailing,
    template.done(progressLabel),
    '',
    template.footer(columns)
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
  const terminalContentWidth = columns
    ? columns - contentPrefixByStyle[style].length - 2
    : fallbackContentWidth;
  const maxContentWidth = Math.max(minContentWidth, terminalContentWidth);

  if (lineWidth <= 0) {
    return maxContentWidth;
  }

  return Math.max(minContentWidth, Math.min(lineWidth, maxContentWidth));
}
