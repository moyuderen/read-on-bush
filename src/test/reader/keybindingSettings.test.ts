import * as assert from 'assert';
import { workspace, ConfigurationTarget } from 'vscode';
import { getReaderKeybindings } from '../../config/settings';
import { formatResolvedCamouflageScreen, resolveBuiltinTemplate } from '../../presentation/reader/rendering';

suite('Reader keybinding settings integration', () => {
  test('updates hints in existing templates, including cached Claude footer widths', async () => {
    const config = workspace.getConfiguration('readOnBush');
    const original = config.inspect('readerKeybindings')?.globalValue;
    try {
      await config.update('readerKeybindings', { toggleDebug: '/' }, ConfigurationTarget.Global);
      assert.strictEqual(getReaderKeybindings().toggleDebug, '/');
      const claude = resolveBuiltinTemplate('claudeCli');
      const build = resolveBuiltinTemplate('buildLog');
      const render = (template: typeof claude) => formatResolvedCamouflageScreen(template, ['body'], '', 200);
      assert.ok(render(claude).includes('/ toggle'));
      assert.ok(render(build).includes('/ toggle'));
      await config.update('readerKeybindings', { toggleDebug: 'x', quit: 'z' }, ConfigurationTarget.Global);
      assert.ok(render(claude).includes('x toggle'));
      assert.ok(render(claude).includes('zz quit'));
      assert.ok(!render(claude).includes('/ toggle'));
      assert.ok(render(build).includes('x toggle'));
    } finally {
      await config.update('readerKeybindings', original, ConfigurationTarget.Global);
    }
  });
});
