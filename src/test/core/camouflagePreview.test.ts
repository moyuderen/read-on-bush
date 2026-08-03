import * as assert from 'assert';
import { terminalScreenToPreviewLines } from '../../core/display/camouflagePreview';
import { clearScreen } from '../../core/display/camouflageRender';

suite('camouflage preview tokens', () => {
  test('converts every supported ANSI style to safe preview segments', () => {
    const screen = `${clearScreen}\x1b[2mdim\x1b[0m ` +
      `\x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m \x1b[33myellow\x1b[0m ` +
      `\x1b[34mblue\x1b[0m \x1b[35mmagenta\x1b[0m \x1b[36mcyan\x1b[0m`;
    const lines = terminalScreenToPreviewLines(screen);
    const styles = lines[0].map((segment) => segment.style);

    for (const style of ['dim', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan']) {
      assert.strictEqual(styles.includes(style as never), true, `${style} should be tokenized`);
    }
  });

  test('keeps HTML-looking text as plain token data and strips controls', () => {
    const lines = terminalScreenToPreviewLines(
      `${clearScreen}<script>alert(1)</script>\x1b[2J\x1b]0;title\x07text`
    );
    const text = lines[0].map((segment) => segment.text).join('');

    assert.strictEqual(text.includes('<script>alert(1)</script>'), true);
    assert.strictEqual(text.includes('\x1b'), false);
    assert.strictEqual(text.endsWith('text'), true);
  });
});
