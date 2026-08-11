import {
  commands,
  env,
  Uri,
  ViewColumn,
  window,
  workspace,
  type ExtensionContext,
  type Webview,
  type WebviewPanel
} from 'vscode';
import { Commands } from '../../config/commands';
import { AppName } from '../../config/constants';
import {
  affectsSetting,
  getTerminalCamouflageStyle
} from '../../config/settings';
import {
  DEFAULT_CUSTOM_TERMINAL_TEMPLATE,
  parseCustomTerminalTemplate,
  type ParsedCustomTerminalTemplate
} from '../readerTemplates/CustomTemplate';
import {
  CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS,
  type CustomTerminalTemplateConfig,
  type ResolvedTerminalTemplate,
  type TerminalTemplate
} from '../readerTemplates';
import { formatResolvedCamouflageScreen } from '../reader/rendering';
import { terminalScreenToPreviewLines } from '../reader/rendering';
import { isRecord } from '../../utils/isRecord';

const VIEW_TYPE = 'readOnBushCustomTemplateEditor';
const PREVIEW_COLUMNS = 100;
const PREVIEW_CONTENT = [
  '这是终端伪装中的第一行阅读内容。',
  '这是第二行内容，用来检查正文前缀和缩进。',
  '这是第三行内容，用来预览最终的日志布局。'
];
const PREVIEW_PROGRESS = '  3/10';

let currentPanel: CustomTemplateEditorPanel | undefined;

export function setupCustomTemplateEditor(context: ExtensionContext): void {
  const openEditor = () => {
    if (currentPanel) {
      currentPanel.reveal();
      return;
    }
    currentPanel = new CustomTemplateEditorPanel(context, () => {
      currentPanel = undefined;
    });
  };

  context.subscriptions.push(
    commands.registerCommand(Commands.OpenCustomTemplateEditor, openEditor),
    workspace.onDidChangeConfiguration((event) => {
      if (
        affectsSetting(event, 'terminalCamouflageStyle') &&
        getTerminalCamouflageStyle() === 'custom'
      ) {
        openEditor();
      }
    })
  );
}

class CustomTemplateEditorPanel {
  private readonly panel: WebviewPanel;
  private draft: unknown;
  private lastValidPreview: ParsedCustomTerminalTemplate;

  constructor(context: ExtensionContext, onDispose: () => void) {
    const resourceRoot = Uri.joinPath(context.extensionUri, 'public', 'webview');
    this.panel = window.createWebviewPanel(
      VIEW_TYPE,
      '配置自定义终端模板',
      ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [resourceRoot]
      }
    );
    context.subscriptions.push(this.panel);

    const parsedDefault = parseCustomTerminalTemplate(DEFAULT_CUSTOM_TERMINAL_TEMPLATE);
    if (!parsedDefault.ok) {
      throw new Error('Default custom terminal template is invalid');
    }
    this.lastValidPreview = parsedDefault.value;

    this.draft = DEFAULT_CUSTOM_TERMINAL_TEMPLATE;
    this.panel.webview.html = buildEditorHtml(this.panel.webview, resourceRoot);
    this.panel.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
    this.panel.onDidDispose(onDispose);
  }

  reveal(): void {
    this.panel.reveal(ViewColumn.Active);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isRecord(message) || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'ready':
        await this.postState(this.draft, true);
        return;
      case 'draftChanged':
        this.draft = message.draft;
        await this.postState(this.draft, false);
        return;
      case 'saveAndEnable':
        this.draft = message.draft;
        await this.saveAndEnable();
        return;
      case 'copyTemplateJson':
        this.draft = message.draft;
        await this.copyJson(false);
        return;
      case 'copySettingsJson':
        this.draft = message.draft;
        await this.copyJson(true);
        return;
    }
  }

  private async postState(draft: unknown, replaceDraft: boolean): Promise<void> {
    const parsed = parseCustomTerminalTemplate(draft);
    if (parsed.ok) {
      this.lastValidPreview = parsed.value;
    }
    const preview = parsed.ok ? parsed.value : this.lastValidPreview;
    const templateJson = parsed.ok
      ? JSON.stringify(parsed.value.config, null, 2)
      : safeStringify(draft);
    const settingsJson = parsed.ok ? formatSettingsJson(parsed.value.config) : '';
    const resolved: ResolvedTerminalTemplate = {
      key: `preview:${preview.canonicalJson}`,
      requestedStyle: 'custom',
      template: preview.template
    };
    const screen = formatResolvedCamouflageScreen(
      resolved,
      PREVIEW_CONTENT,
      PREVIEW_PROGRESS,
      PREVIEW_COLUMNS
    );
    const previewLines = terminalScreenToPreviewLines(screen);

    await this.panel.webview.postMessage({
      type: 'stateUpdated',
      draft: replaceDraft ? draft : undefined,
      replaceDraft,
      styleOptions: CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS,
      diagnostics: parsed.ok ? [] : parsed.diagnostics,
      canSave: parsed.ok,
      templateJson,
      settingsJson,
      previewLines,
      previewSections: computePreviewSections(resolved.template, previewLines.length)
    });
  }

  private async saveAndEnable(): Promise<void> {
    const parsed = parseCustomTerminalTemplate(this.draft);
    if (!parsed.ok) {
      await this.postState(this.draft, false);
      return;
    }

    const configuration = workspace.getConfiguration(AppName);
    // 每个键写到当前生效的作用域：若工作区已有覆盖，写到工作区（否则保存会被静默覆盖）。
    const writeAtEffectiveScope = (key: string, value: unknown) => {
      const inspected = configuration.inspect(key);
      const useGlobal = inspected?.workspaceValue === undefined;
      return configuration.update(key, value, useGlobal);
    };

    const styleInspection = configuration.inspect('terminalCamouflageStyle');
    const templateInspection = configuration.inspect('terminalCamouflageCustomTemplate');
    const savedToWorkspace = [
      styleInspection?.workspaceValue,
      templateInspection?.workspaceValue
    ].some((value) => value !== undefined);

    await Promise.all([
      writeAtEffectiveScope('terminalCamouflageCustomTemplate', parsed.value.config),
      writeAtEffectiveScope('terminalCamouflageStyle', 'custom')
    ]);
    const message = savedToWorkspace
      ? '自定义终端模板已保存到工作区配置并启用'
      : '自定义终端模板已保存到用户配置并启用';
    await this.panel.webview.postMessage({ type: 'notification', message });
    void window.showInformationMessage(message);
  }

  private async copyJson(includeSettings: boolean): Promise<void> {
    const parsed = parseCustomTerminalTemplate(this.draft);
    if (!parsed.ok) {
      await this.postState(this.draft, false);
      return;
    }

    const text = includeSettings
      ? formatSettingsJson(parsed.value.config)
      : JSON.stringify(parsed.value.config, null, 2);
    await env.clipboard.writeText(text);
    await this.panel.webview.postMessage({
      type: 'notification',
      message: includeSettings ? 'settings.json 配置已复制' : '模板 JSON 已复制'
    });
  }
}

function buildEditorHtml(webview: Webview, resourceRoot: Uri): string {
  const scriptUri = webview.asWebviewUri(
    Uri.joinPath(resourceRoot, 'TemplateEditor.js')
  );
  const styleUri = webview.asWebviewUri(
    Uri.joinPath(resourceRoot, 'TemplateEditor.css')
  );
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
    `script-src ${webview.cspSource}`
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${styleUri}">
  <title>配置自定义终端模板</title>
</head>
<body>
  <header class="page-header">
    <div>
      <h1>自定义终端模板</h1>
      <p>通过表单配置普通日志模板。完成行支持 <code>{{progress}}</code> 阅读进度占位符。</p>
    </div>
    <div class="header-actions">
      <button id="save-enable" class="primary">保存并启用</button>
    </div>
  </header>

  <main class="layout">
    <section class="editor-panel">
      <div class="field-grid">
        <label>终端名称<input id="terminal-name" type="text" maxlength="80"></label>
        <label>正文前缀<input id="content-prefix" type="text" maxlength="100"></label>
      </div>
      <div id="sections"></div>
    </section>

    <section class="preview-panel">
      <h2>终端预览</h2>
      <div id="terminal-preview" class="terminal-preview" aria-live="polite"></div>
      <div id="diagnostics" class="diagnostics" hidden></div>

      <div class="json-header">
        <h2>模板 JSON</h2>
        <button id="copy-template" class="secondary">复制模板 JSON</button>
      </div>
      <textarea id="template-json" readonly spellcheck="false"></textarea>

      <div class="json-header">
        <h2>settings.json 配置</h2>
        <button id="copy-settings" class="secondary">复制 settings.json 配置</button>
      </div>
      <textarea id="settings-json" readonly spellcheck="false"></textarea>
    </section>
  </main>
  <div id="notification" class="notification" hidden></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

type PreviewSection = {
  key: 'header' | 'content' | 'trailing' | 'done' | 'keys';
  label: string;
  start: number;
  end: number;
};

function computePreviewSections(
  template: TerminalTemplate,
  totalLines: number
): PreviewSection[] {
  const headerLen = template.header.length;
  const contentLen = PREVIEW_CONTENT.length;
  const trailingLen = template.trailing.length;
  const doneStart = headerLen + contentLen + trailingLen;

  const sections: PreviewSection[] = [
    { key: 'header', label: 'Header', start: 0, end: headerLen },
    {
      key: 'content',
      label: '阅读正文（前缀生效）',
      start: headerLen,
      end: headerLen + contentLen
    },
    {
      key: 'trailing',
      label: 'Trailing',
      start: headerLen + contentLen,
      end: doneStart
    },
    { key: 'done', label: 'Done', start: doneStart, end: doneStart + 1 },
    { key: 'keys', label: '按键提示（固定）', start: totalLines - 1, end: totalLines }
  ];

  return sections.filter((section) => section.start < section.end && section.start < totalLines);
}

function formatSettingsJson(config: CustomTerminalTemplateConfig): string {
  return JSON.stringify(
    {
      [`${AppName}.terminalCamouflageStyle`]: 'custom',
      [`${AppName}.terminalCamouflageCustomTemplate`]: config
    },
    null,
    2
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
}
