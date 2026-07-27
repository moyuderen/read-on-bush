import type { TerminalCamouflageStyle } from '../settings';

// 共享的纯视觉原语：日志模板、折行、宽度计算、拼屏。
// txt 终端伪装与 epub 终端伪装都调用本模块——日志长相只有一份，改样式只改这里。
// 注意：本模块只负责“画成什么样”，不涉及分页/进度（那些是各自格式自己的逻辑）。

export const clearScreen = '\x1b[2J\x1b[H';
export const minContentWidth = 20;
export const fallbackContentWidth = 80;

// 模版使用的安全 ANSI SGR 配色：只用于内置日志/占位内容，真实阅读正文仍会清洗控制符。
const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_BLUE = '\x1b[34m';
const ANSI_MAGENTA = '\x1b[35m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';

// Claude Code 代码 diff 的 ANSI 配色：增/删/块头/弱化上下文。
const DIFF_GREEN = ANSI_GREEN;
const DIFF_RED = ANSI_RED;
const DIFF_CYAN = ANSI_CYAN;
const DIFF_DIM = ANSI_DIM;

// 底部按键提示：单一事实源，固定不可由用户自定义，始终保持与真实按键一致。
// q=快速隐藏(占位模版) · qq=退出 · d=切换占位 · n/p=翻页 · j=跳转 · i=看图(epub)
export const KEYS_HINT = 'keys: q hide · qq quit · d toggle · n/p step · j jump · i image';

export type TerminalCamouflageContentMode = 'real' | 'debugTemplate';

function paint(content: string, color: string): string {
  return `${color}${content}${ANSI_RESET}`;
}

export type TerminalTemplate = {
  // VS Code 终端标签名：切换伪装样式时同步更新，避免内容和终端标题不一致。
  terminalName: string;
  // 正文行前缀：既决定每行长相，也参与正文宽度计算（computeEffectiveLineWidth）。
  contentPrefix: string;
  header: string[];
  trailing: string[];
  // 完成/进度行。
  done: (progress: string) => string;
  // 底部装饰：仅装饰用途；按键提示(KEYS_HINT)由 formatCamouflageScreen 固定追加，不在此处。
  // claudeCli 用于自适应分隔线宽度；其余样式省略。
  footer?: (columns?: number) => string;
  // 快速隐藏(q/d)时展示的假正文行：随样式内置。
  debugContent: string[];
};

// 内置模版：日志长相的唯一事实源。新增样式只需在此追加一份。
const builtinTemplates: Record<TerminalCamouflageStyle, TerminalTemplate> = {
  claudeCli: {
    // Claude Code 的真实输出主体通常没有固定行前缀；正文直接像助手回复一样铺开。
    terminalName: 'Claude Code',
    contentPrefix: '',
    header: [
      paint('✻ Planning…', ANSI_MAGENTA),
      paint('  ⎿  Read src/features/orders/OrderList.tsx', ANSI_DIM),
      paint('  ⎿  Read src/api/orders.ts', ANSI_DIM),
      paint('  ⎿  Grep(pattern: "useInfiniteQuery", path: "src")', ANSI_DIM),
      paint('  ⎿  Bash(npm test -- --runInBand orders)', ANSI_DIM),
      '',
      '我先看了订单列表和接口封装，问题集中在分页状态没有和筛选条件一起重置。方案如下：',
      '  1. 把 pageParam 统一交给 useInfiniteQuery 管理',
      '  2. 筛选条件变化时清空本地 selection / scroll anchor',
      '  3. 补 loading、空状态、失败重试和边界单测',
      '',
      `${DIFF_DIM}Notes:${ANSI_RESET} API 返回 nextCursor=null 时应停止请求，避免重复拉最后一页`,
      ''
    ],
    trailing: [
      '',
      paint('✏️  Updated src/api/orders.ts', ANSI_YELLOW),
      `     ${DIFF_CYAN}@@ -24,7 +24,12 @@${ANSI_RESET}`,
      `   ${DIFF_RED}-  const res = await fetch('/api/orders')${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  const params = new URLSearchParams({ page, size: '20', status })${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  const res = await fetch('/api/orders?' + params.toString())${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  if (!res.ok) throw new Error('订单加载失败')${ANSI_RESET}`,
      '',
      paint('✏️  Updated src/features/orders/OrderList.tsx', ANSI_YELLOW),
      `     ${DIFF_CYAN}@@ -88,6 +91,10 @@${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  if (isError) return <RetryPanel onRetry={refetch} />${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  if (!orders.length) return <EmptyState title="暂无订单" />${ANSI_RESET}`,
      '',
      `● ${DIFF_DIM}npm test -- --runInBand orders${ANSI_RESET}  ${DIFF_GREEN}✓${ANSI_RESET} 18 passed (2.4s)`,
      `● ${DIFF_DIM}npm run lint${ANSI_RESET}  ${DIFF_GREEN}✓${ANSI_RESET} no issues`,
      ''
    ],
    done: (progress) => `* Sautéed for 8m 6s${progress ? ` · ${progress}` : ''}`,
    footer: formatClaudeCliFooter,
    debugContent: [
      paint('I’ll keep the terminal rendering state local to the pseudoterminal and reuse the shared renderer.', ANSI_DIM),
      `     ${DIFF_CYAN}@@ -42,7 +42,11 @@${ANSI_RESET} render(state)`,
      `   ${DIFF_RED}-  this.panel.webview.html = html${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  this.panel.webview.html = renderScreen(state, columns)${ANSI_RESET}`,
      paint('  ⎿  Read src/core/display/terminalCamouflageDisplay.ts', ANSI_DIM),
      paint('  ⎿  Read src/core/display/epubTerminalDisplay.ts', ANSI_DIM),
      paint('  ⎿  Update q handling to require a second confirmation keypress', ANSI_DIM),
      `${DIFF_DIM}stderr:${ANSI_RESET} eslint src --ext ts completed with 0 warnings`,
      paint('✓ TypeScript compile and lint checks are ready to run', ANSI_GREEN)
    ]
  },
  serverLog: {
    terminalName: 'dev server',
    contentPrefix: 'INFO  ',
    header: [
      paint('npm run dev', ANSI_BLUE),
      '',
      paint('INFO  Server listening on http://localhost:3000', ANSI_GREEN),
      paint('INFO  Loaded env from .env.local', ANSI_GREEN),
      paint('INFO  Connected to local workspace cache', ANSI_GREEN),
      paint('INFO  Prisma client initialized pool=8', ANSI_GREEN),
      paint('INFO  GET /api/workspaces 200 14ms trace=trc_71b2', ANSI_GREEN),
      paint('INFO  GET /api/projects/current 200 18ms cache=hit', ANSI_GREEN),
      paint('WARN  feature flag orders.bulkEdit missing, falling back to default=false', ANSI_YELLOW),
      paint('DEBUG requestId=req_42f8 route=/api/runtime/status auth=user_1001', ANSI_DIM),
      ''
    ],
    trailing: [
      '',
      paint('DEBUG requestId=req_42f8 normalized payload in 3ms size=1.8kb', ANSI_DIM),
      paint('INFO  POST /api/runtime/events 202 9ms queue=local', ANSI_GREEN),
      paint('ERROR requestId=req_b19a upstream retryable error: ECONNRESET attempt=1/3', ANSI_RED),
      paint('INFO  retry requestId=req_b19a succeeded in 87ms', ANSI_GREEN),
      paint('INFO  background worker heartbeat ok lag=2ms jobs=0', ANSI_GREEN)
    ],
    done: (progress) => `INFO  request completed${progress}`,
    debugContent: [
      paint('DEBUG requestId=req_91af route=/api/runtime/events payload normalized in 4ms', ANSI_DIM),
      paint('WARN  requestId=req_91af slow query threshold exceeded duration=42ms model=Book', ANSI_YELLOW),
      paint('ERROR requestId=req_91af upstream timeout after 1500ms service=cover-cache', ANSI_RED),
      paint('INFO  GET /api/workspaces/current 200 16ms cache=hit', ANSI_GREEN),
      paint('INFO  POST /api/telemetry/batch 202 11ms queue=local', ANSI_GREEN),
      paint('DEBUG worker=bookshelf-sync heartbeat ok drift=2ms', ANSI_DIM),
      paint('INFO  cache refresh completed keys=24 stale=0', ANSI_GREEN),
      paint('DEBUG requestId=req_a10c route=/api/features flags resolved in 2ms', ANSI_DIM)
    ]
  },
  buildLog: {
    terminalName: 'npm: watch',
    contentPrefix: '[12:42:13] info  ',
    header: [
      paint('> npm run watch', ANSI_BLUE),
      '',
      paint('[12:41:07] Starting compilation in watch mode...', ANSI_DIM),
      paint('[12:41:08] File change detected. Starting incremental compilation...', ANSI_CYAN),
      paint('[12:41:08] Found 0 errors. Watching for file changes.', ANSI_GREEN),
      '',
      'assets by status 128 KiB [cached] 14 assets',
      'runtime modules 3.12 KiB 6 modules',
      'orphan modules 9.61 KiB [orphan] 4 modules',
      'cacheable modules 48.7 KiB',
      '  ./src/extension.ts 2.18 KiB [built] [code generated]',
      '  ./src/core/display/camouflageRender.ts 12.4 KiB [built] [code generated]',
      '  ./src/formats/epub/EpubProvider.ts 4.91 KiB [built]',
      '',
      paint('WARNING in ./src/core/display/index.ts 36:12-28', ANSI_YELLOW),
      paint('export refreshDisplay was not found in ./terminalCamouflageDisplay', ANSI_YELLOW),
      ''
    ],
    trailing: [
      '',
      paint('[12:42:20] info  emitting declaration files...', ANSI_DIM),
      paint('[12:42:21] info  emitted 4 files to out/', ANSI_GREEN),
      '[12:42:21] info  asset extension.js 42.1 KiB [emitted] [minimized]',
      '[12:42:21] info  asset extension.js.map 118 KiB [emitted] [dev]',
      paint('[12:42:22] warn  bundle size limit exceeded: extension.js 42.1 KiB > 40 KiB', ANSI_YELLOW),
      paint('[12:42:22] info  watching for file changes...', ANSI_GREEN)
    ],
    done: (progress) => `[12:42:59] done  compiled successfully${progress}`,
    debugContent: [
      paint('./src/core/display/index.ts 6.21 KiB [built] [code generated]', ANSI_GREEN),
      paint('./src/core/display/camouflageRender.ts 12.4 KiB [built] [code generated]', ANSI_GREEN),
      paint('WARNING in asset size limit: extension.js (42.1 KiB) exceeds recommended size', ANSI_YELLOW),
      paint('ERROR in ./src/core/settings.ts:119:7 TS2322: Type string is not assignable', ANSI_RED),
      paint('webpack 5.91.0 compiled with 1 warning in 418 ms', ANSI_YELLOW),
      paint('asset extension.js 142 KiB [emitted] [minimized]', ANSI_GREEN),
      paint('cached modules 76.4 KiB (javascript) 3.12 KiB (runtime)', ANSI_DIM),
      paint('ts-loader: project references rebuilt in 289 ms', ANSI_CYAN)
    ]
  },
  vite: {
    // Vite 开发服务器：正文行伪装成 HMR/文件事件。
    terminalName: 'vite',
    contentPrefix: '9:42:13 AM [vite] ',
    header: [
      paint('> vite --host 0.0.0.0', ANSI_BLUE),
      '',
      paint('  VITE v5.4.10  ready in 312 ms', ANSI_GREEN),
      paint('  ➜  Local:   http://localhost:5173/', ANSI_CYAN),
      paint('  ➜  Network: http://192.168.1.12:5173/', ANSI_CYAN),
      paint('  ➜  press h + enter to show help', ANSI_DIM),
      '',
      paint('9:42:17 AM [vite] Pre-transform error: Failed to resolve import "@/api/orders"', ANSI_RED),
      paint('9:42:18 AM [vite] Internal server error: Cannot read properties of undefined (reading "map")', ANSI_RED),
      paint('  Plugin: vite:react-babel', ANSI_DIM),
      paint('  File: /src/features/orders/OrderList.tsx:88:21', ANSI_CYAN),
      ''
    ],
    trailing: [
      '',
      paint('9:42:48 AM [vite] hmr update /src/App.tsx, /src/index.css', ANSI_GREEN),
      paint('9:42:51 AM [vite] page reload src/routes/dashboard.tsx', ANSI_CYAN),
      paint('9:42:55 AM [vite] hmr update /src/components/Orders.tsx', ANSI_GREEN),
      paint('9:42:58 AM [vite] ✨ new dependencies optimized: lodash-es, dayjs', ANSI_GREEN),
      paint('9:43:00 AM [vite] hmr invalidate /src/hooks/useOrders.ts Could not Fast Refresh', ANSI_YELLOW)
    ],
    done: (progress) => `9:43:02 AM [vite] optimized${progress}`,
    debugContent: [
      paint('9:42:14 AM [vite] hmr update /src/components/Header.tsx', ANSI_GREEN),
      paint('9:42:15 AM [vite] Pre-transform error: Unexpected token (42:17)', ANSI_RED),
      paint('9:42:16 AM [vite] page reload src/App.tsx', ANSI_CYAN),
      paint('9:42:17 AM [vite] hmr update /src/api/client.ts', ANSI_GREEN),
      paint('9:42:18 AM [vite] new dependencies optimized: axios, zustand', ANSI_GREEN),
      paint('9:42:19 AM [vite] hmr update /src/utils/format.ts', ANSI_GREEN),
      paint('9:42:20 AM [vite] warning: export default was not found in ./ChartCard', ANSI_YELLOW),
      paint('9:42:21 AM [vite] client connected: ws://localhost:5173', ANSI_CYAN)
    ]
  },
  docker: {
    // docker compose up：正文行伪装成容器日志（容器名 | 前缀，正文天然贴合）。
    terminalName: 'docker compose',
    contentPrefix: 'app-api-1  | ',
    header: [
      paint('> docker compose up --build', ANSI_BLUE),
      '',
      paint('[+] Building 7.4s (14/14) FINISHED', ANSI_GREEN),
      ' => [app-api internal] load build definition from Dockerfile 0.0s',
      ' => [app-api 5/6] RUN npm ci --omit=dev 3.8s',
      paint('[+] Running 4/4', ANSI_GREEN),
      paint(' ✔ Network app_default    Created    0.1s', ANSI_GREEN),
      paint(' ✔ Container app-db-1      Started    0.4s', ANSI_GREEN),
      paint(' ✔ Container app-cache-1   Started    0.5s', ANSI_GREEN),
      paint(' ✔ Container app-api-1     Started    0.8s', ANSI_GREEN),
      'Attaching to app-db-1, app-cache-1, app-api-1, app-worker-1',
      ''
    ],
    trailing: [
      '',
      'app-db-1    | 2024-07-27 09:42:13  ready for connections',
      'app-cache-1 | 1:M 27 Jul 2024 09:42:13.420 * Ready to accept connections',
      'app-api-1   | INFO  worker booted in 0.9s, concurrency=4',
      paint('app-worker-1| WARN  queue lag above threshold lag=128ms', ANSI_YELLOW),
      paint('app-api-1   | ERROR failed to publish metrics: dial tcp 10.5.0.8:4317: connect: refused', ANSI_RED),
      paint('app-api-1   | INFO  retrying metrics export in 5s', ANSI_GREEN)
    ],
    done: (progress) => `app-api-1 exited with code 0${progress}`,
    debugContent: [
      paint('app-api-1  | INFO  GET /api/orders 200 14ms request_id=req_710a', ANSI_GREEN),
      paint('app-db-1   | LOG:  duration: 42.118 ms  statement: SELECT * FROM books WHERE id=$1', ANSI_DIM),
      paint('app-api-1  | ERROR UnhandledPromiseRejection: cover cache timeout after 1500ms', ANSI_RED),
      paint('app-cache-1| 1:M 27 Jul 09:42:18.192 * 100 changes in 300 seconds. Saving...', ANSI_CYAN),
      paint('app-api-1  | INFO  POST /api/checkout 201 38ms user_id=usr_42', ANSI_GREEN),
      paint('app-cache-1| INFO  SET order:42 expired in 300s', ANSI_GREEN),
      paint('app-api-1  | INFO  GET /api/products 200 9ms cache=hit', ANSI_GREEN),
      paint('app-worker-1| INFO  completed job=sync-books duration=221ms', ANSI_GREEN)
    ]
  }
};
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

/**
 * Claude Code CLI 的底部输入框/状态栏装饰（不含按键提示——KEYS_HINT 由 formatCamouflageScreen 统一追加）。
 * 分隔线与右对齐按终端列数自适应，终端宽窄变化时也能铺满，伪装性更强。
 */
function formatClaudeCliFooter(columns?: number): string {
  const width = columns && columns > 0 ? columns : fallbackContentWidth;
  const divider = '─'.repeat(width);
  const hint = 'new task? /clear to save 308.4k tokens';
  return [
    rightAlignLine(hint, width),
    divider,
    '›',
    divider,
    fitLineToWidth('[opus-4.8[1m]] ██████░░░░░░░░ 30% | 💰 $16.17 | ⏱ 305m 44s', width)
  ].join('\r\n');
}

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
 * columns 透传给 footer（仅 claudeCli 用到，用于自适应分隔线宽度）。
 * KEYS_HINT 固定追加在最后，始终展示真实按键。
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
  const doneLine = template.done(stripUnsafeTerminalControls(progressLabel));
  const footer = template.footer?.(columns);

  const lines = [
    ...template.header,
    ...contentLines.map((content, index) =>
      `${index === 0 ? template.contentPrefix : indent}${sanitizeLine(content)}`
    ),
    ...template.trailing,
    doneLine,
    '',
    ...(footer ? [footer] : []),
    KEYS_HINT
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

function rightAlignLine(content: string, width: number): string {
  return fitLineToWidth(content, width).padStart(width);
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
