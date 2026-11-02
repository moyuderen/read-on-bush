import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

suite('Reader webview input', () => {
  test('updates active keys without reload and leaves modified shortcuts alone', () => {
    const rootListeners: Record<string, (event: unknown) => void> = {};
    const windowListeners: Record<string, (event: unknown) => void> = {};
    const sent: unknown[] = [];
    const root = {
      appendChild: () => {}, focus: () => {},
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        rootListeners[type] = listener;
      }
    };
    const screen = { childElementCount: 0 };
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, '../../../public/webview/readerView.js'), 'utf8'),
      {
        acquireVsCodeApi: () => ({ postMessage: (message: unknown) => sent.push(message) }),
        document: {
          getElementById: (id: string) => id === 'reader-root' ? root : screen,
          createElement: () => ({})
        },
        window: {
          readOnBushProtocol: { version: 1, styles: [], inputKeys: ['d'] },
          addEventListener: (type: string, listener: (event: unknown) => void) => {
            windowListeners[type] = listener;
          }
        },
        ResizeObserver: class { observe(): void {} },
        requestAnimationFrame: () => 1
      }
    );
    sent.length = 0;
    const press = (key: string, flags = {}) => rootListeners.keydown({
      key, preventDefault: () => {}, stopPropagation: () => {}, ...flags
    });
    windowListeners.message({ data: { type: 'frame', lines: [], inputKeys: ['/'] } });
    press('/');
    press('d');
    press('/', { ctrlKey: true });
    press('/', { altKey: true });
    press('/', { metaKey: true });
    press('/', { isComposing: true });
    press('ArrowRight');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(sent)), [
      { type: 'input', protocol: 1, data: '/' },
      { type: 'input', protocol: 1, data: '\x1b[C' }
    ]);
    sent.length = 0;
    windowListeners.message({ data: { type: 'frame', lines: [], inputKeys: ['d'] } });
    press('/');
    press('D');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(sent)), [
      { type: 'input', protocol: 1, data: 'd' }
    ]);
  });
});
