export type TemplateHelpers = {
  fallbackContentWidth: number;
  getTextWidth: (text: string) => number;
  fitLineToWidth: (content: string, width: number) => string;
  joinLeftAndRight: (left: string, right: string, width: number) => string;
};

export type TerminalTemplate = {
  // VS Code 终端标签名：切换伪装样式时同步更新，避免内容和终端标题不一致。
  terminalName: string;
  // 正文行前缀：既决定每行长相，也参与正文宽度计算（computeEffectiveLineWidth）。
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
