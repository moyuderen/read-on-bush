import * as assert from 'assert';
import {
  DEFAULT_CUSTOM_TERMINAL_TEMPLATE,
  parseCustomTerminalTemplate
} from '../../core/display/camouflageTemplates/customTemplate';
import {
  computeResolvedEffectiveLineWidth,
  resolveBuiltinTemplate,
  updateTerminalTemplate
} from '../../core/display/camouflageRender';

suite('custom terminal camouflage template', () => {
  test('parses the default example and compiles progress and colors', () => {
    const result = parseCustomTerminalTemplate(DEFAULT_CUSTOM_TERMINAL_TEMPLATE);
    assert.strictEqual(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.strictEqual(result.value.template.terminalName, 'dev server');
    assert.strictEqual(result.value.template.header[0].includes('\x1b[34m'), true);
    assert.strictEqual(result.value.template.done('  3/10').includes('  3/10'), true);
    assert.strictEqual(result.value.canonicalJson, JSON.stringify(result.value.config));
  });

  test('done line does not treat $-patterns in progress as substitutions', () => {
    const result = parseCustomTerminalTemplate({
      ...DEFAULT_CUSTOM_TERMINAL_TEMPLATE,
      done: { text: 'done{{progress}}', style: 'plain' }
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) {
      return;
    }
    const progress = '  regex $& special · 3/10';
    const rendered = result.value.template.done(progress);

    assert.strictEqual(rendered.includes('{{progress}}'), false);
    assert.strictEqual(rendered.includes('$&'), true);
    assert.strictEqual(rendered.endsWith('done  regex $& special · 3/10'), true);
  });

  test('accepts plain strings and styled line objects', () => {
    const result = parseCustomTerminalTemplate({
      version: 1,
      terminalName: 'custom',
      contentPrefix: '日志  ',
      header: ['plain', { text: 'warning', style: 'yellow' }],
      trailing: [],
      done: 'done{{progress}}',
      debugContent: [{ text: 'debug', style: 'dim' }]
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.strictEqual(result.value.template.header[0], 'plain');
    assert.strictEqual(result.value.template.header[1], '\x1b[33mwarning\x1b[0m');
    assert.strictEqual(result.value.template.done('  1/2'), 'done  1/2');
  });

  test('rejects unknown fields, styles and placeholders', () => {
    const result = parseCustomTerminalTemplate({
      version: 1,
      terminalName: 'custom',
      contentPrefix: '',
      header: [{ text: 'line', style: 'orange' }],
      trailing: [],
      done: 'done {{percent}}',
      debugContent: [],
      bottom: []
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) {
      return;
    }

    const paths = result.diagnostics.map((diagnostic) => diagnostic.path);
    assert.strictEqual(paths.includes('bottom'), true);
    assert.strictEqual(paths.includes('header[0].style'), true);
    assert.strictEqual(paths.includes('done'), true);
  });

  test('uses display width for wide prefixes and updates custom terminal titles', () => {
    const result = parseCustomTerminalTemplate({
      ...DEFAULT_CUSTOM_TERMINAL_TEMPLATE,
      terminalName: 'custom title',
      contentPrefix: '日志  '
    });
    assert.strictEqual(result.ok, true);
    if (!result.ok) {
      return;
    }

    const resolved = {
      key: `custom:${result.value.canonicalJson}`,
      requestedStyle: 'custom' as const,
      template: result.value.template
    };
    assert.strictEqual(computeResolvedEffectiveLineWidth(0, 40, resolved), 32);

    let title = '';
    updateTerminalTemplate(resolveBuiltinTemplate('buildLog'), resolved, (value) => {
      title = value;
    });
    assert.strictEqual(title.includes('custom title'), true);
  });

  test('rejects terminal control characters from user templates', () => {
    const result = parseCustomTerminalTemplate({
      version: 1,
      terminalName: 'custom\x1b]0;owned\x07',
      contentPrefix: '',
      header: ['safe\x1b[31mred'],
      trailing: [],
      done: 'done{{progress}}',
      debugContent: []
    });
    assert.strictEqual(result.ok, false);
    if (result.ok) {
      return;
    }

    assert.strictEqual(
      result.diagnostics.some((diagnostic) => diagnostic.path === 'terminalName'),
      true
    );
    assert.strictEqual(
      result.diagnostics.some((diagnostic) => diagnostic.path === 'header[0]'),
      true
    );
  });
});
