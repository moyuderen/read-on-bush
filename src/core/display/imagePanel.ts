import { randomBytes } from 'crypto';
import { ViewColumn, window, type WebviewPanel } from 'vscode';
import { getImagePreviewMode, type ImagePreviewMode } from '../settings';

/**
 * 图片预览面板（epub / pdf 共用）。从 EpubReader 抽出，避免 epub/pdf 各自重复 webview
 * 生命周期与按键处理。缩略图模式下点击图片切换大小，点击空白或按键关闭。
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

export function buildImageHtml(
  mediaType: string,
  base64: string,
  imagePreviewMode: ImagePreviewMode
): string {
  const nonce = randomBytes(16).toString('hex');
  const thumbnailMode = imagePreviewMode === 'thumbnail';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  body {
    margin: 0;
    background: var(--vscode-panel-background, var(--vscode-editor-background));
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    cursor: pointer;
    outline: none;
  }

  .image {
    display: block;
  }

  .image.thumbnail {
    max-width: min(18vw, 180px);
    max-height: min(20vh, 160px);
    cursor: zoom-in;
  }

  .image.expanded {
    max-width: 100%;
    max-height: 100vh;
    cursor: pointer;
  }

  .hint {
    position: fixed;
    bottom: 8px;
    right: 12px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    pointer-events: none;
  }
</style>
</head>
<body tabindex="0">
<img class="image" src="data:${mediaType};base64,${base64}" alt="图片预览" />
<div class="hint"></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const body = document.body;
  const image = document.querySelector('.image');
  const hint = document.querySelector('.hint');
  const canToggleImage = ${thumbnailMode};
  let isThumbnail = canToggleImage;
  let closed = false;

  const postCloseOnce = () => {
    if (closed) {
      return;
    }
    closed = true;
    vscode.postMessage('close');
  };

  const updateView = () => {
    image.classList.toggle('thumbnail', isThumbnail);
    image.classList.toggle('expanded', !isThumbnail);
    image.setAttribute('aria-label', isThumbnail ? '点击查看大图' : '点击缩小图片');
    hint.textContent = canToggleImage
      ? isThumbnail
        ? '点击图片查看大图 · 点击空白处或按任意键关闭'
        : '点击图片缩小 · 点击空白处或按任意键关闭'
      : '按任意键 / 点击关闭';
  };

  const handleImageClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canToggleImage) {
      postCloseOnce();
      return;
    }
    isThumbnail = !isThumbnail;
    updateView();
  };

  const handleKeydown = (event) => {
    if (event.key.toLowerCase() === 'd') {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage('toggleDebugContent');
      return;
    }

    postCloseOnce();
  };

  const focusBody = () => body.focus({ preventScroll: true });
  image.addEventListener('click', handleImageClick);
  body.addEventListener('click', postCloseOnce);
  window.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('load', focusBody);
  updateView();
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
    panel.webview.html = buildImageHtml(
      options.mediaType,
      options.base64,
      getImagePreviewMode()
    );
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
