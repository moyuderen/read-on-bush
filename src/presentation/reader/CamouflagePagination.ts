import type { ResolvedTerminalTemplate } from '../readerTemplates';
import type { ReadingDisplayState } from './ReaderDisplayTypes';
import {
  formatResolvedCamouflageScreen,
  formatResolvedDebugCamouflageScreen,
  getTextWidth,
  resolveBuiltinTemplate,
  splitContent,
  type TerminalCamouflageContentMode
} from './rendering';

// —— txt 专用分页：在扁平 contents[] 上按 process 游标取一屏（epub 不走这里）——

function getForwardChunkCount(state: ReadingDisplayState, lineWidth: number, lineCount: number): number {
  const targetWidth = lineWidth * lineCount;
  let contentWidth = 0;
  let chunkCount = 0;

  for (let index = state.process; index < state.contents.length; index++) {
    const chunk = state.contents[index];

    if (!chunk) {
      continue;
    }

    const chunkWidth = getTextWidth(chunk);

    if (chunkCount > 0 && contentWidth + chunkWidth > targetWidth) {
      break;
    }

    chunkCount++;
    contentWidth += chunkWidth;
  }

  return Math.max(chunkCount, 1);
}

function getBackwardChunkCount(state: ReadingDisplayState, lineWidth: number, lineCount: number): number {
  const targetWidth = lineWidth * lineCount;
  let contentWidth = 0;
  let chunkCount = 0;

  for (let index = state.process - 1; index >= 0; index--) {
    const chunk = state.contents[index];

    if (!chunk) {
      continue;
    }

    const chunkWidth = getTextWidth(chunk);

    if (chunkCount > 0 && contentWidth + chunkWidth > targetWidth) {
      break;
    }

    chunkCount++;
    contentWidth += chunkWidth;
  }

  return Math.max(chunkCount, 1);
}

function getTerminalContentLines(state: ReadingDisplayState, lineWidth: number, lineCount: number): string[] {
  const chunkCount = getForwardChunkCount(state, lineWidth, lineCount);
  const content = state.contents.slice(state.process, state.process + chunkCount).join('') || state.content;
  return splitContent(content, lineWidth).slice(0, lineCount);
}

export function getTerminalNextProcessStep(
  state: ReadingDisplayState,
  lineWidth: number,
  lineCount: number
): number {
  return getForwardChunkCount(state, lineWidth, lineCount);
}

export function getTerminalPrevProcessStep(
  state: ReadingDisplayState,
  lineWidth: number,
  lineCount: number
): number {
  return getBackwardChunkCount(state, lineWidth, lineCount);
}

/**
 * txt 的拼屏：算出本屏要显示的行 + txt 的 `current/total` 进度文案，
 * 再交给共享的 formatCamouflageScreen 画成日志。行为与重构前完全一致。
 */
export function formatTerminalCamouflageScreen(
  state: ReadingDisplayState,
  showProgress: boolean,
  lineWidth: number,
  lineCount: number,
  template: ResolvedTerminalTemplate = resolveBuiltinTemplate('buildLog'),
  columns?: number,
  contentMode: TerminalCamouflageContentMode = 'real'
): string {
  if (contentMode === 'debugTemplate') {
    return formatResolvedDebugCamouflageScreen(template, lineWidth, lineCount, columns);
  }

  const contentLines = getTerminalContentLines(state, lineWidth, lineCount);
  const current = state.total > 0 ? Math.min(state.process + 1, state.total) : 0;
  const progressLabel = showProgress ? `  ${current}/${state.total}` : '';
  return formatResolvedCamouflageScreen(template, contentLines, progressLabel, columns);
}
