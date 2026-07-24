import * as assert from 'assert';
import { BookFormatRegistry } from '../../formats/registry';
import type { BookFormatProvider } from '../../formats/types';

function createProvider(
  format: string,
  extensions: string[],
  importName: (filePath: string) => string = () => 'imported'
): BookFormatProvider & { lastPath?: string } {
  let lastPath: string | undefined;
  const provider: BookFormatProvider & { lastPath?: string } = {
    format,
    supportedExtensions: extensions,
    async importBook(input) {
      lastPath = input.filePath;
      return {
        id: input.id,
        name: importName(input.filePath),
        process: 0,
        url: input.filePath,
        format
      };
    },
    async createReader() {
      throw new Error('not implemented');
    }
  };
  Object.defineProperty(provider, 'lastPath', { get: () => lastPath });
  return provider;
}

suite('BookFormatRegistry', () => {
  test('exposes extensions from all registered providers', () => {
    const registry = new BookFormatRegistry([
      createProvider('txt', ['txt']),
      createProvider('epub', ['epub'])
    ]);

    assert.deepStrictEqual(registry.getSupportedExtensions().sort(), ['epub', 'txt']);
    assert.strictEqual(registry.isSupportedBookPath('/a/b/book.epub'), true);
    assert.strictEqual(registry.isSupportedBookPath('/a/b/book.pdf'), false);
  });

  test('routes import to the matching provider by extension', async () => {
    const txt = createProvider('txt', ['txt']);
    const epub = createProvider('epub', ['epub']);
    const registry = new BookFormatRegistry([txt, epub]);

    const provider = registry.getProviderByPath('/shelf/novel.epub');
    await provider.importBook({ id: '1', name: 'novel', filePath: '/shelf/novel.epub' } as any);

    assert.strictEqual((epub as any).lastPath, '/shelf/novel.epub');
    assert.strictEqual((txt as any).lastPath, undefined);
  });

  test('resolves provider for an existing book by path', () => {
    const registry = new BookFormatRegistry([
      createProvider('txt', ['txt']),
      createProvider('epub', ['epub'])
    ]);

    assert.strictEqual(
      registry.getProviderForBook({ id: '1', name: 'b', process: 0, url: '/x.epub', format: 'epub' })?.format,
      'epub'
    );
    assert.strictEqual(
      registry.getProviderForBook({ id: '2', name: 'b', process: 0, url: '/x.txt' })?.format,
      'txt'
    );
  });

  test('returns undefined for an unknown-format book instead of throwing', () => {
    const registry = new BookFormatRegistry([createProvider('txt', ['txt'])]);
    assert.strictEqual(
      registry.getProviderForBook({ id: '1', name: 'b', process: 0, url: '/x.pdf' }),
      undefined
    );
  });

  test('throws a clear error for unsupported extensions', () => {
    const registry = new BookFormatRegistry([createProvider('txt', ['txt'])]);
    assert.throws(() => registry.getProviderByPath('/x.pdf'), /Unsupported book format/);
  });
});
