import type { TerminalCamouflageStyle } from '../../config/settings';

// 安全 SGR 调色板的单一事实源：样式名 ↔ SGR 码。
// 编译（style→ANSI）、预览解析（码→style）、清洗净则（码白名单）全部从这里派生，
// 新增颜色只需改这一处。
export const STYLE_SGR_ENTRIES = [
  { style: 'plain', code: '0' },
  { style: 'dim', code: '2' },
  { style: 'red', code: '31' },
  { style: 'green', code: '32' },
  { style: 'yellow', code: '33' },
  { style: 'blue', code: '34' },
  { style: 'magenta', code: '35' },
  { style: 'cyan', code: '36' }
] as const;

export const CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS = STYLE_SGR_ENTRIES.map(
  (entry) => entry.style
);

export type CustomTemplateLineStyle =
  (typeof CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS)[number];

// 安全 SGR 码的联合正则分支，例如 "0|2|31|32|33|34|35|36"。
export const SAFE_SGR_CODE_ALTERNATION = STYLE_SGR_ENTRIES.map(
  (entry) => entry.code
).join('|');

export type CustomTemplateLine =
  | string
  | {
      text: string;
      style?: CustomTemplateLineStyle;
    };

export type CustomTerminalTemplateConfig = {
  version: 1;
  terminalName: string;
  contentPrefix: string;
  header: CustomTemplateLine[];
  trailing: CustomTemplateLine[];
  done: CustomTemplateLine;
  debugContent: CustomTemplateLine[];
};

export type CustomTemplateDiagnostic = {
  path: string;
  message: string;
};

export type TemplateHelpers = {
  fallbackContentWidth: number;
  getTextWidth: (text: string) => number;
  fitLineToWidth: (content: string, width: number) => string;
  joinLeftAndRight: (left: string, right: string, width: number) => string;
};

export type TerminalTemplate = {
  // VS Code 终端标签名：切换伪装样式时同步更新，避免内容和终端标题不一致。
  terminalName: string;
  // 正文行前缀：既决定每行长相，也参与正文宽度计算（computeResolvedEffectiveLineWidth）。
  contentPrefix: string;
  header: string[];
  trailing: string[];
  // 完成/进度行。columns 仅供需要自适应排版的模版使用。
  done: (progress: string, columns?: number) => string;
  // 需要自定义底部顺序的模版可以直接返回完整底部区块。
  // progress 用于让模版内的装饰进度与真实阅读进度联动。
  bottom?: (progress: string, columns?: number) => string[];
  // 快速隐藏(q/d)时展示的假正文行：随样式内置。
  debugContent: string[];
};

export type ResolvedTerminalTemplate = {
  key: string;
  requestedStyle: TerminalCamouflageStyle;
  template: TerminalTemplate;
};
