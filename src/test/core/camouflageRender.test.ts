import * as assert from 'assert';
import {
  formatCamouflageScreen,
  formatDebugCamouflageScreen,
  getDebugContentLines,
  getTextWidth
} from '../../core/display/camouflageRender';
import type { TerminalCamouflageStyle } from '../../core/settings';

suite('camouflageRender conceal helpers', () => {
  const styles: TerminalCamouflageStyle[] = ['buildLog', 'claudeCli', 'serverLog'];

  test('getDebugContentLines returns style-specific bounded debug content', () => {
    const outputs = styles.map((style) => getDebugContentLines(style, 36, 3));

    for (const lines of outputs) {
      assert.strictEqual(lines.length, 3);
      assert.strictEqual(lines.every((line) => getTextWidth(line) <= 36), true);
    }

    assert.notDeepStrictEqual(outputs[0], outputs[1]);
    assert.notDeepStrictEqual(outputs[1], outputs[2]);
    assert.notDeepStrictEqual(outputs[0], outputs[2]);
  });

  test('getDebugContentLines pads to the requested line count', () => {
    const lines = getDebugContentLines('buildLog', 120, 10);

    assert.strictEqual(lines.length, 10);
    assert.strictEqual(lines.every((line) => getTextWidth(line) <= 120), true);
  });

  test('formatDebugCamouflageScreen renders concealed lines without real progress', () => {
    const screen = formatDebugCamouflageScreen('claudeCli', 50, 2);

    assert.strictEqual(screen.includes('1/9'), false);
    assert.strictEqual(screen.includes('I’ll keep the terminal rendering state local'), true);
  });

  test('formatCamouflageScreen strips unsafe terminal control sequences from content and progress', () => {
    const screen = formatCamouflageScreen(
      'buildLog',
      ['safe\x1b[2J\x1b]8;;https://example.com\x07link\x1b]8;;\x07text'],
      '  chapter\x1b[2J · 20%'
    );
    const body = screen.replace(/^\x1b\[2J\x1b\[H/, '');

    assert.strictEqual(body.includes('\x1b[2J'), false);
    assert.strictEqual(body.includes('\x1b]8'), false);
    assert.strictEqual(body.includes('safelinktext'), true);
    assert.strictEqual(body.includes('chapter · 20%'), true);
  });

  test('formatCamouflageScreen keeps Claude CLI footer lines within terminal width', () => {
    const width = 24;
    const lines = formatCamouflageScreen('claudeCli', ['content'], '', width).split('\r\n');
    const footerLines = lines.slice(-6);

    assert.strictEqual(footerLines[0].length <= width, true);
    assert.strictEqual(footerLines[1].length, width);
    assert.strictEqual(footerLines[3].length, width);
    assert.strictEqual(getTextWidth(footerLines[4]) <= width, true);
    assert.strictEqual(getTextWidth(footerLines[5]) <= width, true);
  });
});
