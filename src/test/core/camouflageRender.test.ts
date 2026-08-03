import * as assert from 'assert';
import {
  KEYS_HINT,
  formatResolvedCamouflageScreen,
  formatResolvedDebugCamouflageScreen,
  formatResolvedTerminalTitle,
  getResolvedDebugContentLines,
  getTextWidth,
  resolveBuiltinTemplate
} from '../../core/display/camouflageRender';
import { BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS } from '../../core/settings';
import type { BuiltinTerminalCamouflageStyle } from '../../core/settings';

const resolve = (style: BuiltinTerminalCamouflageStyle) => resolveBuiltinTemplate(style);

suite('camouflageRender conceal helpers', () => {
  const styles: readonly BuiltinTerminalCamouflageStyle[] =
    BUILTIN_TERMINAL_CAMOUFLAGE_STYLE_OPTIONS;

  test('getDebugContentLines returns style-specific bounded debug content', () => {
    const outputs = styles.map((style) =>
      getResolvedDebugContentLines(resolve(style), 36, 3)
    );

    for (const lines of outputs) {
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines.every((line) => getTextWidth(line) <= 36), true);
    }

    // 每个样式的假正文都各不相同
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        assert.notDeepStrictEqual(outputs[i], outputs[j]);
      }
    }
  });

  test('getDebugContentLines pads to the requested line count', () => {
    const lines = getResolvedDebugContentLines(resolve('buildLog'), 120, 10);

    assert.strictEqual(lines.length, 10);
    assert.strictEqual(lines.every((line) => getTextWidth(line) <= 120), true);
  });

  test('formatDebugCamouflageScreen renders concealed lines without real progress', () => {
    const screen = formatResolvedDebugCamouflageScreen(resolve('claudeCli'), 50, 2);

    assert.strictEqual(screen.includes('1/9'), false);
    assert.strictEqual(screen.includes('I’ll keep the terminal rendering state local'), true);
  });

  test('debug camouflage keeps trusted template colors while real content strips controls', () => {
    const debugScreen = formatResolvedDebugCamouflageScreen(resolve('serverLog'), 80, 3);
    assert.strictEqual(/\x1b\[(?:31|32|33|36|2)m/.test(debugScreen), true);

    const realScreen = formatResolvedCamouflageScreen(
      resolve('serverLog'),
      ['real\x1b[31mred'],
      '\x1b[32m  1/2'
    );
    assert.strictEqual(realScreen.includes('realred'), true);
    assert.strictEqual(realScreen.includes('\x1b[31mred'), false);
    assert.strictEqual(realScreen.includes('\x1b[32m  1/2'), false);
  });

  test('formatCamouflageScreen strips unsafe terminal control sequences from content and progress', () => {
    const screen = formatResolvedCamouflageScreen(
      resolve('buildLog'),
      ['safe\x1b[2J\x1b]8;;https://example.com\x07link\x1b]8;;\x07text'],
      '  chapter\x1b[2J · 20%'
    );
    const body = screen.replace(/^\x1b\[2J\x1b\[H/, '');

    assert.strictEqual(body.includes('\x1b[2J'), false);
    assert.strictEqual(body.includes('\x1b]8'), false);
    assert.strictEqual(body.includes('safelinktext'), true);
    assert.strictEqual(body.includes('chapter · 20%'), true);
  });

  test('terminal title matches the selected camouflage style', () => {
    assert.strictEqual(resolve('buildLog').template.terminalName, 'npm: watch');
    assert.strictEqual(resolve('claudeCli').template.terminalName, 'Claude Code');
    assert.strictEqual(resolve('serverLog').template.terminalName, 'dev server');
    assert.strictEqual(resolve('vite').template.terminalName, 'vite');
    assert.strictEqual(resolve('docker').template.terminalName, 'docker compose');
    assert.strictEqual(formatResolvedTerminalTitle(resolve('vite')), '\x1b]0;vite\x07');
  });

  test('formatCamouflageScreen keeps Claude CLI footer art within terminal width', () => {
    const width = 24;
    const lines = formatResolvedCamouflageScreen(
      resolve('claudeCli'),
      ['content'],
      '',
      width
    ).split('\r\n');
    // 末尾 4 行是 claudeCli 的输入框装饰，状态栏保持在面板最后。
    const footerArt = lines.slice(-4);

    assert.strictEqual(footerArt[0].length, width);
    assert.strictEqual(footerArt[2].length, width);
    assert.strictEqual(getTextWidth(footerArt[3]) <= width, true);
    assert.notStrictEqual(lines[lines.length - 1], KEYS_HINT);
  });

  test('Claude CLI summary and status bar follow reading progress', () => {
    const lines = formatResolvedCamouflageScreen(
      resolve('claudeCli'),
      ['content'],
      '  草船借箭 · 全书 78%',
      120
    ).split('\r\n');
    const summary = lines.find((line) => line.startsWith('* Sautéed for'));
    const status = lines.find((line) => line.startsWith('[opus-4.8[1m]]'));

    assert.strictEqual(summary?.includes('草船借箭 · 78%'), true);
    assert.strictEqual(summary?.includes('全书'), false);
    assert.strictEqual(summary?.includes('new task? /clear to save 308.4k tokens'), true);
    assert.strictEqual(status?.includes('███████████░░░ 78%'), true);

    const narrowSummary = formatResolvedCamouflageScreen(
      resolve('claudeCli'),
      ['content'],
      '  草船借箭 · 全书 78%',
      24
    ).split('\r\n').find((line) => line.startsWith('* '));
    assert.strictEqual(narrowSummary?.includes('草船借箭 · 78%'), true);

    const lowProgressStatus = formatResolvedCamouflageScreen(
      resolve('claudeCli'),
      ['content'],
      '  草船借箭 · 全书 7%',
      120
    );
    assert.strictEqual(lowProgressStatus.includes('██░░░░░░░░░░░░ 7%'), true);

    const txtStatus = formatResolvedCamouflageScreen(
      resolve('claudeCli'),
      ['content'],
      '  3/10',
      120
    );
    assert.strictEqual(txtStatus.includes('████░░░░░░░░░░ 30%'), true);
  });

  test('key hint is rendered in a style-appropriate position', () => {
    for (const style of styles) {
      const lines = formatResolvedCamouflageScreen(resolve(style), ['x'], '  1/2', 120).split('\r\n');
      if (style === 'claudeCli') {
        const lintIndex = lines.findIndex((line) => line.includes('npm run lint'));
        const hintIndex = lines.findIndex((line) => line.includes('q hide · qq quit'));
        const doneIndex = lines.findIndex((line) => line.startsWith('* Sautéed'));

        assert.strictEqual(hintIndex > lintIndex, true);
        assert.strictEqual(hintIndex < doneIndex, true);
        assert.notStrictEqual(lines[lines.length - 1], KEYS_HINT);
      } else {
        assert.strictEqual(lines[lines.length - 1], KEYS_HINT, `${style} should end with key hint`);
      }
    }
  });

  test('vite and docker presets render their signature look', () => {
    const vite = formatResolvedCamouflageScreen(resolve('vite'), ['hello world'], '', 80);
    assert.strictEqual(vite.includes('[vite]'), true);
    assert.strictEqual(vite.includes('VITE v5.4.10'), true);
    assert.strictEqual(vite.includes('optimized'), true);

    const docker = formatResolvedCamouflageScreen(resolve('docker'), ['hello world'], '', 80);
    assert.strictEqual(docker.includes('app-api-1  | '), true);
    assert.strictEqual(docker.includes('docker compose up'), true);
  });
});
