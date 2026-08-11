/**
 * 自动翻页的时间策略。
 *
 * 两种模式：
 * - 按字数估算（默认）：根据当前页可见字符数和阅读速度计算停留时间，钳制到 [min, max] 区间。
 * - 固定秒数：用户设置 fixedSeconds > 0 时完全覆盖按字数计算。
 */

export type AutoTurnConfig = {
  /** 阅读速度：字符/分钟。默认 450。 */
  speedCharsPerMin: number;
  /** 单页最短停留秒数。默认 2。 */
  minSeconds: number;
  /** 单页最长停留秒数。默认 30。 */
  maxSeconds: number;
  /** 固定每页秒数。> 0 时覆盖按字数计算；0 表示使用按字数模式。 */
  fixedSeconds: number;
};

export const defaultAutoTurnConfig: AutoTurnConfig = {
  speedCharsPerMin: 450,
  minSeconds: 2,
  maxSeconds: 30,
  fixedSeconds: 0
};

const INVISIBLE_CHARS = new RegExp('\\x1b\\[[0-9;]*m|[\\x00-\\x1F\\x7F\\u200B-\\u200D\\uFEFF\\s]', 'g');

/**
 * 统计可见文本字符数：去除 ANSI 转义、控制字符、零宽字符和所有空白，
 * 只保留用户实际需要阅读的字符。
 */
export function countVisibleCharacters(text: string): number {
  return text.replace(INVISIBLE_CHARS, '').length;
}

/** 根据可见字符数和配置计算单页停留毫秒数。 */
export function getAutoTurnDelayMs(visibleChars: number, config: AutoTurnConfig): number {
  if (config.fixedSeconds > 0) {
    return config.fixedSeconds * 1000;
  }

  if (config.speedCharsPerMin <= 0 || visibleChars <= 0) {
    return config.minSeconds * 1000;
  }

  const minutes = visibleChars / config.speedCharsPerMin;
  const seconds = minutes * 60;
  const clamped = Math.min(Math.max(seconds, config.minSeconds), config.maxSeconds);
  return clamped * 1000;
}
