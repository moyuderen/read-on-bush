import * as vscode from 'vscode';
import { commands } from 'vscode';
import {
  isReaderViewMessage,
  readerViewProtocolVersion,
  type ReaderViewDimensions,
  type ReaderViewFrame,
  type ReaderViewHostMessage
} from './ReaderViewProtocol';
import { formatResolvedTerminalIdleScreen } from '../reader/rendering';
import { STYLE_SGR_ENTRIES, type ResolvedTerminalTemplate } from '../readerTemplates';
import { CAMOUFLAGE_INPUT_KEYS } from '../readerControls';
import type { ReaderSurface, ReaderSurfaceFrame } from './ReaderSurface';
import { createReaderSurfaceFrame } from './ReaderFrame';

export const readerViewId = 'readOnBush-readerView';

const minColumns = 20;
const maxColumns = 1000;
const minRows = 1;
const maxRows = 500;

export class ReaderViewSurface implements vscode.WebviewViewProvider, ReaderSurface {
  private readonly resizeEmitter = new vscode.EventEmitter<ReaderViewDimensions>();
  private webviewView?: vscode.WebviewView;
  private webviewDisposables: vscode.Disposable[] = [];
  private inputHandler?: (data: string) => void;
  private dimensions?: ReaderViewDimensions;
  private latestFrame?: ReaderViewFrame;

  readonly onDidResize = this.resizeEmitter.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.disposeWebviewDisposables();
    this.webviewView = webviewView;

    const webview = webviewView.webview;
    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'public', 'webview');
    webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewRoot]
    };
    webview.html = this.getHtml(webview, webviewRoot);

    this.webviewDisposables.push(
      webview.onDidReceiveMessage((message: unknown) => {
        if (!isReaderViewMessage(message)) {
          return;
        }

        if (message.type === 'ready') {
          this.postLatestFrame();
          return;
        }

        if (message.type === 'resize') {
          const dimensions = {
            columns: Math.min(Math.max(message.columns, minColumns), maxColumns),
            rows: Math.min(Math.max(message.rows, minRows), maxRows)
          };
          if (
            dimensions.columns === this.dimensions?.columns &&
            dimensions.rows === this.dimensions?.rows
          ) {
            return;
          }
          this.dimensions = dimensions;
          this.resizeEmitter.fire(dimensions);
          return;
        }

        this.inputHandler?.(message.data);
      }),
      webviewView.onDidDispose(() => {
        if (this.webviewView === webviewView) {
          this.webviewView = undefined;
        }
        this.disposeWebviewDisposables();
      }),
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          this.postLatestFrame();
        }
      })
    );
  }

  setInputHandler(handler: ((data: string) => void) | undefined): void {
    this.inputHandler = handler;
  }

  publishFrame(frame: ReaderSurfaceFrame): void {
    this.latestFrame = {
      type: 'frame',
      protocol: readerViewProtocolVersion,
      mode: frame.mode,
      terminalName: frame.template.template.terminalName,
      lines: frame.lines
    };
    this.postLatestFrame();
  }

  publishIdle(template: ResolvedTerminalTemplate): void {
    this.publishFrame(
      createReaderSurfaceFrame(formatResolvedTerminalIdleScreen(template), template, 'real')
    );
  }

  /** 在面板中显示一条提示文案（终端模式下引导用户去终端阅读）。 */
  publishHint(text: string): void {
    this.latestFrame = {
      type: 'frame',
      protocol: readerViewProtocolVersion,
      mode: 'real',
      terminalName: 'Read On Bush',
      lines: [[{ text, style: 'dim' }]]
    };
    this.postLatestFrame();
  }

  clear(): void {
    this.latestFrame = undefined;
    this.post({
      type: 'clear',
      protocol: readerViewProtocolVersion
    });
  }

  focus(): void {
    // 先通过命令打开面板容器并聚焦 webview view，再发 focus 消息让 DOM 获取焦点
    void commands.executeCommand(`${readerViewId}.focus`);
    this.webviewView?.show(false);
    this.post({
      type: 'focus',
      protocol: readerViewProtocolVersion
    });
  }

  dispose(): void {
    this.disposeWebviewDisposables();
    this.resizeEmitter.dispose();
    this.webviewView = undefined;
    this.inputHandler = undefined;
    this.latestFrame = undefined;
  }

  private postLatestFrame(): void {
    if (this.latestFrame) {
      this.post(this.latestFrame);
      return;
    }

    this.post({
      type: 'clear',
      protocol: readerViewProtocolVersion
    });
  }

  private post(message: ReaderViewHostMessage): void {
    if (!this.webviewView?.visible) {
      return;
    }
    void this.webviewView.webview.postMessage(message);
  }

  private disposeWebviewDisposables(): void {
    for (const disposable of this.webviewDisposables) {
      disposable.dispose();
    }
    this.webviewDisposables = [];
  }

  private getHtml(webview: vscode.Webview, webviewRoot: vscode.Uri): string {
    const stylesheet = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'readerView.css')
    );
    const script = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'readerView.js'));
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`
    ].join('; ');
    const protocolConfig = JSON.stringify({
      version: readerViewProtocolVersion,
      styles: STYLE_SGR_ENTRIES.map(({ style }) => style),
      inputKeys: CAMOUFLAGE_INPUT_KEYS
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${stylesheet}">
  <title>阅读</title>
</head>
<body>
  <main id="reader-root" class="reader-shell" tabindex="0" aria-label="阅读内容">
    <div id="reader-screen" class="reader-screen" role="log" aria-live="polite"></div>
  </main>
  <script nonce="${nonce}">window.readOnBushProtocol = ${protocolConfig};</script>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index++) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
