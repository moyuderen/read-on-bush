// 模版使用的安全 ANSI SGR 配色：只用于内置日志/占位内容，真实阅读正文仍会清洗控制符。
export const ANSI_RED = '\x1b[31m';
export const ANSI_GREEN = '\x1b[32m';
export const ANSI_YELLOW = '\x1b[33m';
export const ANSI_BLUE = '\x1b[34m';
export const ANSI_MAGENTA = '\x1b[35m';
export const ANSI_CYAN = '\x1b[36m';
export const ANSI_DIM = '\x1b[2m';
export const ANSI_RESET = '\x1b[0m';

// Claude Code 代码 diff 的 ANSI 配色：增/删/块头/弱化上下文。
export const DIFF_GREEN = ANSI_GREEN;
export const DIFF_RED = ANSI_RED;
export const DIFF_CYAN = ANSI_CYAN;
export const DIFF_DIM = ANSI_DIM;

export function paint(content: string, color: string): string {
  return `${color}${content}${ANSI_RESET}`;
}
