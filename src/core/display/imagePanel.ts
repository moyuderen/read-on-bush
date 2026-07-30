import { ViewColumn, window, type WebviewPanel } from 'vscode';

/**
 * 图片预览面板（epub / pdf 共用）。从 EpubReader 抽出，避免 epub/pdf 各自重复 webview
 * 生命周期与按键处理。行为：任意键 / 点击关闭；按 d 切换伪装调试文案；关闭后回调收回焦点。
 */

export type ImagePreviewOptions = {
  title: string;
  mediaType: string;
  base64: string;
  /** 按下 d 时触发（切换真实内容 / 模板占位）。 */
  onToggleDebug?: () => void;
  /** 面板关闭后回调（通常用于把焦点拉回伪装终端，便于立即再按 i）。 */
  onRefocus?: () => void;
};

export function buildImageHtml(mediaType: string, base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body tabindex="0" style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;cursor:pointer;outline:none">
<img src="data:${mediaType};base64,${base64}" style="max-width:100%;max-height:100vh;object-fit:contain" />
<div style="position:fixed;bottom:8px;right:12px;color:#999;font-size:12px;pointer-events:none">按任意键 / 点击关闭</div>
<script>
  const vscode = acquireVsCodeApi();
  let closed = false;
  const postOnce = (message) => {
    if (closed) {
      return;
    }
    closed = true;
    vscode.postMessage(message);
  };
  const close = () => postOnce('close');
  const handleKeydown = (event) => {
    if (event.key.toLowerCase() === 'd') {
      event.preventDefault();
      event.stopPropagation();
      postOnce('toggleDebugContent');
      return;
    }

    close();
  };
  const focusBody = () => document.body.focus({ preventScroll: true });
  window.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('keydown', handleKeydown, true);
  document.body.addEventListener('click', close);
  window.addEventListener('load', focusBody);
  setTimeout(focusBody, 0);
</script>
</body>
</html>`;
}

export class ImagePreviewPanel {
  private panel?: WebviewPanel;

  get isOpen(): boolean {
    return this.panel !== undefined;
  }

  /** 打开（或替换为新的）图片预览。再次调用前会先关闭旧面板。 */
  show(options: ImagePreviewOptions): void {
    this.close();
    const panel = window.createWebviewPanel(
      'readOnBushImagePreview',
      options.title,
      ViewColumn.Active,
      { enableScripts: true }
    );
    panel.webview.html = buildImageHtml(options.mediaType, options.base64);
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg === 'toggleDebugContent') {
        options.onToggleDebug?.();
        return;
      }
      if (msg === 'close') {
        this.close();
      }
    });
    panel.onDidDispose(() => {
      this.panel = undefined;
      options.onRefocus?.();
    });
    this.panel = panel;
  }

  close(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    this.panel = undefined;
    panel.dispose();
  }
}
