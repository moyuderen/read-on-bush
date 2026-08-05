import * as assert from 'assert';
import {
  defaultSettings,
  IMAGE_PREVIEW_MODE_OPTIONS
} from '../../core/settings';
import { buildImageHtml } from '../../core/display/imagePanel';

function assertIncludes(value: string, ...snippets: string[]): void {
  for (const snippet of snippets) {
    assert.ok(value.includes(snippet), `Expected HTML to include: ${snippet}`);
  }
}

describe('ImagePreviewPanel HTML', () => {
  it('defaults image previews to thumbnail mode', () => {
    assert.deepStrictEqual(IMAGE_PREVIEW_MODE_OPTIONS, ['thumbnail', 'large']);
    assert.strictEqual(defaultSettings.imagePreviewMode, 'thumbnail');
  });

  it('builds a thumbnail-first view with explicit image toggling', () => {
    const html = buildImageHtml('image/png', 'abc123', 'thumbnail');
    const nonce = html.match(/style-src 'nonce-([a-f0-9]+)'/)?.[1];

    assert.ok(nonce);
    assertIncludes(
      html,
      'data:image/png;base64,abc123',
      'class="image"',
      'max-width: min(18vw, 180px);',
      'max-height: min(20vh, 160px);',
      'Content-Security-Policy',
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      "vscode.postMessage('toggleDebugContent');"
    );
    assert.strictEqual(html.includes('unsafe-inline'), false);
  });

  it('builds a large-first view that keeps image clicks as close actions', () => {
    const html = buildImageHtml('image/jpeg', 'def456', 'large');

    assertIncludes(
      html,
      'data:image/jpeg;base64,def456',
      'class="image"',
      '按任意键 / 点击关闭'
    );
  });
});
