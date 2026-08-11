import { paint } from './AnsiTemplate';
import { isRecord } from '../../utils/isRecord';
import {
  CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS,
  STYLE_SGR_ENTRIES,
  type CustomTemplateDiagnostic,
  type CustomTemplateLine,
  type CustomTemplateLineStyle,
  type CustomTerminalTemplateConfig,
  type TerminalTemplate
} from './TemplateTypes';

const ROOT_FIELDS = [
  'version',
  'terminalName',
  'contentPrefix',
  'header',
  'trailing',
  'done',
  'debugContent'
] as const;
const LINE_FIELDS = ['text', 'style'] as const;
const MAX_NAME_LENGTH = 80;
const MAX_PREFIX_LENGTH = 100;
const MAX_LINE_LENGTH = 1000;
const MAX_SECTION_LINES = 100;
const CONTROL_SEQUENCE_RE = /[\x00-\x1f\x7f-\x9f]/;
const PLACEHOLDER_RE = /{{[^{}]*}}/g;

// 由调色板单一事实源派生：style → ANSI 转义（plain 不上色）。
const STYLE_ANSI: Partial<Record<CustomTemplateLineStyle, string>> =
  Object.fromEntries(
    STYLE_SGR_ENTRIES.filter((entry) => entry.style !== 'plain').map((entry) => [
      entry.style,
      `\x1b[${entry.code}m`
    ])
  );

export const DEFAULT_CUSTOM_TERMINAL_TEMPLATE: CustomTerminalTemplateConfig = {
  version: 1,
  terminalName: 'dev server',
  contentPrefix: 'INFO  ',
  header: [
    { text: 'npm run dev', style: 'blue' },
    '',
    { text: 'INFO  Server listening on http://localhost:3000', style: 'green' },
    { text: 'INFO  Loaded configuration from .env.local', style: 'green' },
    { text: 'INFO  Connected to local database', style: 'green' },
    { text: 'WARN  Development mode is enabled', style: 'yellow' },
    ''
  ],
  trailing: [
    '',
    { text: 'DEBUG request processed in 12ms', style: 'dim' },
    { text: 'INFO  Background worker heartbeat ok', style: 'green' }
  ],
  done: { text: 'INFO  request completed{{progress}}', style: 'green' },
  debugContent: [
    { text: 'INFO  GET /api/workspaces 200 14ms', style: 'green' },
    { text: 'DEBUG requestId=req_42 normalized payload in 3ms', style: 'dim' },
    { text: 'WARN  slow query detected duration=42ms', style: 'yellow' },
    { text: 'ERROR upstream request timeout after 1500ms', style: 'red' }
  ]
};

export type ParsedCustomTerminalTemplate = {
  config: CustomTerminalTemplateConfig;
  template: TerminalTemplate;
  canonicalJson: string;
};

export type ParseCustomTerminalTemplateResult =
  | { ok: true; value: ParsedCustomTerminalTemplate }
  | { ok: false; diagnostics: CustomTemplateDiagnostic[] };

export function parseCustomTerminalTemplate(input: unknown): ParseCustomTerminalTemplateResult {
  const diagnostics: CustomTemplateDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      diagnostics: [{ path: '$', message: '模板必须是 JSON 对象' }]
    };
  }

  reportUnknownFields(input, ROOT_FIELDS, '$', diagnostics);

  if (input.version !== 1) {
    diagnostics.push({ path: 'version', message: '模板版本必须为 1' });
  }

  const terminalName = readText(
    input.terminalName,
    'terminalName',
    diagnostics,
    MAX_NAME_LENGTH,
    false,
    true
  );
  const contentPrefix = readText(
    input.contentPrefix,
    'contentPrefix',
    diagnostics,
    MAX_PREFIX_LENGTH
  );
  const header = readLines(input.header, 'header', diagnostics);
  const trailing = readLines(input.trailing, 'trailing', diagnostics);
  const done = readLine(input.done, 'done', diagnostics, true);
  const debugContent = readLines(input.debugContent, 'debugContent', diagnostics);

  if (diagnostics.length > 0 || terminalName === undefined || contentPrefix === undefined ||
      header === undefined || trailing === undefined || done === undefined || debugContent === undefined) {
    return { ok: false, diagnostics };
  }

  const config: CustomTerminalTemplateConfig = {
    version: 1,
    terminalName,
    contentPrefix,
    header,
    trailing,
    done,
    debugContent
  };
  const compiledDone = compileLine(done);
  const template: TerminalTemplate = {
    terminalName,
    contentPrefix,
    header: header.map(compileLine),
    trailing: trailing.map(compileLine),
    // 用函数替换：避免 progress 含 $& / $' / $` 时被当作 $-替换模式，
    // 否则会把 {{progress}} 字面量泄漏进输出并破坏章节标题片段。
    done: (progress) => compiledDone.replaceAll('{{progress}}', () => progress),
    debugContent: debugContent.map(compileLine)
  };

  return {
    ok: true,
    value: {
      config,
      template,
      canonicalJson: JSON.stringify(config)
    }
  };
}

function readLines(
  value: unknown,
  path: string,
  diagnostics: CustomTemplateDiagnostic[]
): CustomTemplateLine[] | undefined {
  if (!Array.isArray(value)) {
    diagnostics.push({ path, message: '必须是数组' });
    return undefined;
  }
  if (value.length > MAX_SECTION_LINES) {
    diagnostics.push({ path, message: `最多允许 ${MAX_SECTION_LINES} 行` });
  }

  const lines: CustomTemplateLine[] = [];
  for (let index = 0; index < Math.min(value.length, MAX_SECTION_LINES); index++) {
    const line = readLine(value[index], `${path}[${index}]`, diagnostics, false);
    if (line !== undefined) {
      lines.push(line);
    }
  }
  return lines;
}

function readLine(
  value: unknown,
  path: string,
  diagnostics: CustomTemplateDiagnostic[],
  allowProgress: boolean
): CustomTemplateLine | undefined {
  if (typeof value === 'string') {
    const text = readText(value, path, diagnostics, MAX_LINE_LENGTH, allowProgress);
    return text;
  }
  if (!isRecord(value)) {
    diagnostics.push({ path, message: '必须是字符串或包含 text/style 的对象' });
    return undefined;
  }

  reportUnknownFields(value, LINE_FIELDS, path, diagnostics);
  const text = readText(value.text, `${path}.text`, diagnostics, MAX_LINE_LENGTH, allowProgress);
  const style = readStyle(value.style, `${path}.style`, diagnostics);
  if (text === undefined || style === undefined) {
    return undefined;
  }
  if (style === 'plain') {
    return text;
  }
  return { text, style };
}

function readText(
  value: unknown,
  path: string,
  diagnostics: CustomTemplateDiagnostic[],
  maxLength: number,
  allowProgress = false,
  requireNonEmpty = false
): string | undefined {
  if (typeof value !== 'string') {
    diagnostics.push({ path, message: '必须是字符串' });
    return undefined;
  }
  if (requireNonEmpty && value.trim().length === 0) {
    diagnostics.push({ path, message: '不能为空' });
  }
  if (value.length > maxLength) {
    diagnostics.push({ path, message: `不能超过 ${maxLength} 个字符` });
  }
  if (CONTROL_SEQUENCE_RE.test(value)) {
    diagnostics.push({ path, message: '不能包含换行、ANSI 或其他控制字符' });
  }

  const placeholders = value.match(PLACEHOLDER_RE) ?? [];
  if (placeholders.some((placeholder) => !allowProgress || placeholder !== '{{progress}}')) {
    diagnostics.push({ path, message: '仅 done 支持 {{progress}} 占位符' });
  }
  const withoutProgress = value.replaceAll('{{progress}}', '');
  if (withoutProgress.includes('{{') || withoutProgress.includes('}}')) {
    diagnostics.push({ path, message: '包含无法识别的占位符' });
  }
  return value;
}

function readStyle(
  value: unknown,
  path: string,
  diagnostics: CustomTemplateDiagnostic[]
): CustomTemplateLineStyle | undefined {
  if (value === undefined) {
    return 'plain';
  }
  if (typeof value !== 'string' ||
      !(CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS as readonly string[]).includes(value)) {
    diagnostics.push({
      path,
      message: `仅支持 ${CUSTOM_TEMPLATE_LINE_STYLE_OPTIONS.join(', ')}`
    });
    return undefined;
  }
  return value as CustomTemplateLineStyle;
}

function compileLine(line: CustomTemplateLine): string {
  if (typeof line === 'string') {
    return line;
  }
  const color = line.style ? STYLE_ANSI[line.style] : undefined;
  return color ? paint(line.text, color) : line.text;
}

function reportUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  diagnostics: CustomTemplateDiagnostic[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      diagnostics.push({
        path: path === '$' ? key : `${path}.${key}`,
        message: '不支持该字段'
      });
    }
  }
}

