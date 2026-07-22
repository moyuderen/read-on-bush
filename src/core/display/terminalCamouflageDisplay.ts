import { commands, EventEmitter, window } from 'vscode';
import type { ExtensionContext, Pseudoterminal, Terminal, TerminalDimensions } from 'vscode';
import { Commands } from '../Commands';
import type { TerminalCamouflageStyle } from '../settings';
import type { ReadingDisplayState } from './types';

const terminalName = 'npm: watch';
const clearScreen = '\x1b[2J\x1b[H';
const minContentWidth = 20;
const fallbackContentWidth = 80;

type TerminalTemplate = {
  contentPrefix: string;
  header: string[];
  trailing: string[];
  done: (progress: string) => string;
  footer: string;
};

function getTemplate(style: TerminalCamouflageStyle): TerminalTemplate {
  if (style === 'claudeCli') {
    return {
      contentPrefix: '  ⎿  ',
      header: [
        'claude',
        '',
        '✻ Thinking…',
        '⎿  Read src/core/display/terminalCamouflageDisplay.ts',
        '⎿  Read src/core/settings.ts',
        '⎿  Search(pattern: "terminalCamouflage", path: "src")',
        '⎿  Update Todos',
        '',
        '● I’ll keep the display state centralized and update the terminal renderer next.',
        '',
        '✢ Processing…',
        ''
      ],
      trailing: [
        '',
        '⎿  Modified src/core/display/terminalCamouflageDisplay.ts',
        '⎿  Running npm run compile',
        '⎿  Running npm run lint'
      ],
      done: (progress) => `● Update complete${progress}`,
      footer: 'esc to interrupt · n/p step · j jump · q stop'
    };
  }

  if (style === 'serverLog') {
    return {
      contentPrefix: 'INFO  ',
      header: [
        'npm run dev',
        '',
        'INFO  Server listening on http://localhost:3000',
        'INFO  Loaded env from .env.local',
        'INFO  Connected to local workspace cache',
        'INFO  GET /api/workspaces 200 14ms',
        'INFO  GET /api/projects/current 200 18ms',
        'INFO  cache warmed in 38ms',
        'DEBUG requestId=req_42f8 route=/api/runtime/status',
        ''
      ],
      trailing: [
        '',
        'DEBUG requestId=req_42f8 normalized payload in 3ms',
        'INFO  POST /api/runtime/events 202 9ms',
        'INFO  background worker heartbeat ok'
      ],
      done: (progress) => `INFO  request completed${progress}`,
      footer: 'Press n/p to step, j to jump, q to stop.'
    };
  }

  return {
    contentPrefix: '[12:42:13] info  ',
    header: [
      '> npm run watch',
      '',
      '[12:41:07] Starting compilation in watch mode...',
      '[12:41:08] File change detected. Starting incremental compilation...',
      '[12:41:08] Found 0 errors. Watching for file changes.',
      '',
      'assets by status 128 KiB [cached] 14 assets',
      'runtime modules 3.12 KiB 6 modules',
      'orphan modules 9.61 KiB [orphan] 4 modules',
      'cacheable modules 48.7 KiB',
      '  ./src/extension.ts 2.18 KiB [built] [code generated]',
      '  ./src/core/index.ts 1.67 KiB [built] [code generated]',
      ''
    ],
    trailing: [
      '',
      '[12:42:21] info  emitted 4 files to out/',
      '[12:42:21] info  asset extension.js 42.1 KiB [emitted]',
      '[12:42:22] info  watching for file changes...'
    ],
    done: (progress) => `[12:42:59] done  compiled successfully${progress}`,
    footer: 'Press n/p to step, j to jump, q to stop.'
  };
}

function sanitizeContent(content: string): string {
  return content
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t\f\v 　]+/g, ' ')
    .trim();
}

function getCharWidth(char: string): number {
  return /[^\x00-\xff]/.test(char) ? 2 : 1;
}

function getTextWidth(text: string): number {
  return Array.from(text).reduce((width, char) => width + getCharWidth(char), 0);
}

function splitContent(content: string, lineWidth: number): string[] {
  const sanitized = sanitizeContent(content);

  if (!sanitized) {
    return [''];
  }

  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const char of Array.from(sanitized)) {
    const charWidth = getCharWidth(char);

    if (currentWidth + charWidth > lineWidth) {
      lines.push(currentLine.trim());
      currentLine = char;
      currentWidth = charWidth;
      continue;
    }

    currentLine += char;
    currentWidth += charWidth;
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

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

export function formatTerminalIdleScreen(style: TerminalCamouflageStyle = 'buildLog'): string {
  const template = getTemplate(style);
  const lines = [...template.header, ...template.trailing, template.done('')];

  return `${clearScreen}${lines.join('\r\n')}`;
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

export function formatTerminalCamouflageScreen(
  state: ReadingDisplayState,
  showProgress: boolean,
  lineWidth: number,
  lineCount: number,
  style: TerminalCamouflageStyle = 'buildLog'
): string {
  const template = getTemplate(style);
  const indent = ' '.repeat(template.contentPrefix.length);
  const contentLines = getTerminalContentLines(state, lineWidth, lineCount);
  const current = state.total > 0 ? Math.min(state.process + 1, state.total) : 0;
  const progress = showProgress ? `  ${current}/${state.total}` : '';
  const lines = [
    ...template.header,
    ...contentLines.map((content, index) => `${index === 0 ? template.contentPrefix : indent}${content}`),
    ...template.trailing,
    template.done(progress),
    '',
    template.footer
  ];

  return `${clearScreen}${lines.join('\r\n')}`;
}

export class TerminalCamouflageDisplay implements Pseudoterminal {
  private readonly writeEmitter = new EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;

  private terminal?: Terminal;
  private dimensions?: TerminalDimensions;
  private lastState?: ReadingDisplayState;
  private lastShowProgress = false;
  private lastLineWidth = 0;
  private lastLineCount = 3;
  private lastStyle: TerminalCamouflageStyle = 'buildLog';
  private pendingOutput?: string;
  private opened = false;

  constructor(private readonly context: ExtensionContext) {}

  open() {
    this.opened = true;
    this.writeEmitter.fire(this.pendingOutput || formatTerminalIdleScreen(this.lastStyle));
    this.pendingOutput = undefined;
  }

  close() {
    this.opened = false;
    this.terminal = undefined;
  }

  setDimensions(dimensions: TerminalDimensions) {
    this.dimensions = dimensions;
    this.renderLastState();
  }

  handleInput(data: string) {
    if (data === '\x1b[C' || data.toLowerCase() === 'n') {
      commands.executeCommand(Commands.NextLine);
      return;
    }

    if (data === '\x1b[D' || data.toLowerCase() === 'p') {
      commands.executeCommand(Commands.PrevLine);
      return;
    }

    if (data.toLowerCase() === 'j') {
      commands.executeCommand(Commands.JumpLine);
      return;
    }

    if (data.toLowerCase() === 'q') {
      commands.executeCommand(Commands.Stop);
    }
  }

  render(
    state: ReadingDisplayState,
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ) {
    this.lastState = state;
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.lastStyle = style;
    this.ensureTerminal();
    this.write(
      formatTerminalCamouflageScreen(
        state,
        showProgress,
        this.getEffectiveLineWidth(lineWidth, style),
        lineCount,
        style
      )
    );
  }

  pause() {
    if (!this.terminal && !this.opened) {
      return;
    }

    this.write(formatTerminalIdleScreen(this.lastStyle));
  }

  reveal(
    showProgress: boolean,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ) {
    this.lastShowProgress = showProgress;
    this.lastLineWidth = lineWidth;
    this.lastLineCount = lineCount;
    this.lastStyle = style;
    this.ensureTerminal();

    if (this.lastState) {
      this.write(
        formatTerminalCamouflageScreen(
          this.lastState,
          showProgress,
          this.getEffectiveLineWidth(lineWidth, style),
          lineCount,
          style
        )
      );
      return;
    }

    this.write(formatTerminalIdleScreen(style));
  }

  hide() {
    this.pendingOutput = undefined;
    this.terminal?.dispose();
    this.terminal = undefined;
    this.opened = false;
  }

  getNextProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ): number {
    return getTerminalNextProcessStep(state, this.getEffectiveLineWidth(lineWidth, style), lineCount);
  }

  getPrevProcessStep(
    state: ReadingDisplayState,
    lineWidth: number,
    lineCount: number,
    style: TerminalCamouflageStyle
  ): number {
    return getTerminalPrevProcessStep(state, this.getEffectiveLineWidth(lineWidth, style), lineCount);
  }

  private getEffectiveLineWidth(lineWidth: number, style: TerminalCamouflageStyle): number {
    const template = getTemplate(style);
    const terminalContentWidth = this.dimensions?.columns
      ? this.dimensions.columns - template.contentPrefix.length - 2
      : fallbackContentWidth;
    const maxContentWidth = Math.max(minContentWidth, terminalContentWidth);

    if (lineWidth <= 0) {
      return maxContentWidth;
    }

    return Math.max(minContentWidth, Math.min(lineWidth, maxContentWidth));
  }

  private renderLastState() {
    if (!this.opened || !this.lastState) {
      return;
    }

    this.write(
      formatTerminalCamouflageScreen(
        this.lastState,
        this.lastShowProgress,
        this.getEffectiveLineWidth(this.lastLineWidth, this.lastStyle),
        this.lastLineCount,
        this.lastStyle
      )
    );
  }

  private ensureTerminal() {
    if (this.terminal) {
      this.terminal.show(true);
      return;
    }

    this.terminal = window.createTerminal({ name: terminalName, pty: this });
    this.context.subscriptions.push(this.terminal);
    this.terminal.show(true);
  }

  private write(text: string) {
    if (!this.opened) {
      this.pendingOutput = text;
      return;
    }

    this.writeEmitter.fire(text);
  }
}
