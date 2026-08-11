import * as assert from 'assert';
import { CamouflageTemplateService } from '../../presentation/reader/rendering';
import { DEFAULT_CUSTOM_TERMINAL_TEMPLATE } from '../../presentation/readerTemplates/CustomTemplate';

suite('CamouflageTemplateService', () => {
  test('keeps builtin templates unchanged', () => {
    const service = new CamouflageTemplateService();
    const resolved = service.resolve({ style: 'claudeCli', customTemplate: null });

    assert.strictEqual(resolved.key, 'builtin:claudeCli');
    assert.strictEqual(resolved.template.terminalName, 'Claude Code');
  });

  test('uses the last valid custom template when the next value is invalid', () => {
    const service = new CamouflageTemplateService();
    const valid = service.resolve({
      style: 'custom',
      customTemplate: DEFAULT_CUSTOM_TERMINAL_TEMPLATE
    });
    const invalid = service.resolve({ style: 'custom', customTemplate: { version: 1 } });

    assert.strictEqual(valid.key.startsWith('custom:'), true);
    assert.strictEqual(invalid, valid);
  });

  test('falls back to buildLog before any custom template is valid', () => {
    const service = new CamouflageTemplateService();
    const resolved = service.resolve({ style: 'custom', customTemplate: null });

    assert.strictEqual(resolved.key, 'builtin:buildLog');
    assert.strictEqual(resolved.requestedStyle, 'custom');
    assert.strictEqual(resolved.template.terminalName, 'npm: watch');
  });

  test('reuses a compiled template for equivalent normalized config', () => {
    const service = new CamouflageTemplateService();
    const first = service.resolve({
      style: 'custom',
      customTemplate: DEFAULT_CUSTOM_TERMINAL_TEMPLATE
    });
    const second = service.resolve({
      style: 'custom',
      customTemplate: JSON.parse(JSON.stringify(DEFAULT_CUSTOM_TERMINAL_TEMPLATE))
    });

    assert.strictEqual(second, first);
  });
});
