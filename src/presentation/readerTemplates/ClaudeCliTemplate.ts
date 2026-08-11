import { ANSI_DIM, ANSI_GREEN, ANSI_MAGENTA, ANSI_RESET, ANSI_YELLOW, DIFF_CYAN, DIFF_DIM, DIFF_GREEN, DIFF_RED, paint } from './AnsiTemplate';
import { CLAUDE_CLI_SHORTCUT_HINT } from './TemplateKeys';
import type { TemplateHelpers, TerminalTemplate } from './TemplateTypes';

type ParsedReadingProgress = {
  label: string;
  percent?: number;
};

function parseReadingProgress(progress: string): ParsedReadingProgress {
  const label = progress.trim().replace(/全书\s+(?=\d+(?:\.\d+)?\s*%)/g, '');
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  let lastPercent: number | undefined;
  let percentMatch: RegExpExecArray | null;

  while ((percentMatch = percentPattern.exec(progress)) !== null) {
    lastPercent = Number(percentMatch[1]);
  }

  if (lastPercent !== undefined) {
    return { label, percent: clampPercent(lastPercent) };
  }

  const ratioMatch = /(\d+)\s*\/\s*(\d+)/.exec(progress);
  if (!ratioMatch) {
    return { label };
  }

  const current = Number(ratioMatch[1]);
  const total = Number(ratioMatch[2]);
  return {
    label,
    percent: total > 0 ? clampPercent((current / total) * 100) : 0
  };
}

function clampPercent(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function createClaudeCliTemplate({
  fallbackContentWidth,
  getTextWidth,
  fitLineToWidth,
  joinLeftAndRight
}: TemplateHelpers): TerminalTemplate {
  const resolveWidth = (columns?: number): number =>
    columns && columns > 0 ? columns : fallbackContentWidth;
  const bottomChromeCache = new Map<number, { divider: string; shortcutHint: string }>();

  const getBottomChrome = (width: number): { divider: string; shortcutHint: string } => {
    const cached = bottomChromeCache.get(width);
    if (cached) {
      return cached;
    }

    const chrome = {
      divider: '─'.repeat(width),
      shortcutHint: paint(fitLineToWidth(CLAUDE_CLI_SHORTCUT_HINT, width), ANSI_DIM)
    };
    bottomChromeCache.set(width, chrome);
    return chrome;
  };

  const renderActiveSummaryFromParsed = (parsed: ParsedReadingProgress, width: number): string => {
    const summary = `* Sautéed for 8m 6s${parsed.label ? ` · ${parsed.label}` : ''}`;
    const visibleSummary =
      parsed.label && getTextWidth(summary) > width ? `* ${parsed.label}` : summary;
    return joinLeftAndRight(visibleSummary, 'new task? /clear to save 308.4k tokens', width);
  };

  const renderIdleDone = (progress: string): string => {
    const { label } = parseReadingProgress(progress);
    return `* Sautéed for 8m 6s${label ? ` · ${label}` : ''}`;
  };

  const renderBottom = (progress: string, columns?: number): string[] => {
    const parsed = parseReadingProgress(progress);
    const width = resolveWidth(columns);
    const { divider, shortcutHint } = getBottomChrome(width);
    const doneLine = renderActiveSummaryFromParsed(parsed, width);
    const percent = parsed.percent ?? 30;
    const totalBlocks = 14;
    const minVisibleBlocks = percent > 0 ? 2 : 0;
    const filledBlocks = Math.min(
      totalBlocks,
      Math.max(minVisibleBlocks, Math.round((percent / 100) * totalBlocks))
    );
    const progressBar = `${'█'.repeat(filledBlocks)}${'░'.repeat(totalBlocks - filledBlocks)}`;
    const status = `[opus-4.8[1m]] ${progressBar} ${percent}% | 💰 $16.17 | ⏱ 305m 44s`;
    const footer = [divider, '›', divider, fitLineToWidth(status, width)].join('\r\n');

    return [shortcutHint, doneLine, '', footer];
  };

  return {
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
      `● ${DIFF_DIM}npm test -- --runInBand orders${ANSI_RESET}  ${DIFF_GREEN}✓${ANSI_RESET} 18 passed (2.4s)`,
      `● ${DIFF_DIM}npm run lint${ANSI_RESET}  ${DIFF_GREEN}✓${ANSI_RESET} no issues`,
      ''
    ],
    done: renderIdleDone,
    bottom: renderBottom,
    debugContent: [
      paint('I’ll keep the terminal rendering state local to the pseudoterminal and reuse the shared renderer.', ANSI_DIM),
      `     ${DIFF_CYAN}@@ -42,7 +42,11 @@${ANSI_RESET} render(state)`,
      `   ${DIFF_RED}-  this.panel.webview.html = html${ANSI_RESET}`,
      `   ${DIFF_GREEN}+  this.panel.webview.html = renderScreen(state, columns)${ANSI_RESET}`,
      paint('  ⎿  Read src/presentation/reader/TxtCamouflageDisplay.ts', ANSI_DIM),
      paint('  ⎿  Read src/presentation/reader/PaginatedReaderDisplay.ts', ANSI_DIM),
      paint('  ⎿  Update q handling to require a second confirmation keypress', ANSI_DIM),
      `${DIFF_DIM}stderr:${ANSI_RESET} eslint src --ext ts completed with 0 warnings`,
      paint('✓ TypeScript compile and lint checks are ready to run', ANSI_GREEN)
    ]
  };
}
