import * as assert from 'assert';
import { BookFormatRegistry } from '../../formats/BookFormatRegistry';
import { createDefaultBookFormatRegistry } from '../../formats';
import type { BookFormatProvider } from '../../formats/BookFormat';

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
    createReader() {
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

suite('BookFormatRegistry convertible classification', () => {
  function createRegistry(convertible: string[] = ['mobi', 'azw3', 'pdf']) {
    return new BookFormatRegistry(
      [createProvider('txt', ['txt']), createProvider('epub', ['epub'])],
      convertible
    );
  }

  test('classifyPath distinguishes supported / convertible / unknown', () => {
    const registry = createRegistry();
    assert.strictEqual(registry.classifyPath('/a/b/book.txt'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.epub'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.mobi'), 'convertible');
    assert.strictEqual(registry.classifyPath('/a/b/book.pdf'), 'convertible');
    assert.strictEqual(registry.classifyPath('/a/b/book.docx'), 'unknown');
    assert.strictEqual(registry.classifyPath('/a/b/book'), 'unknown');
  });

  test('supported takes priority when an extension is registered as both', () => {
    const registry = new BookFormatRegistry(
      [createProvider('pdf', ['pdf'])],
      ['mobi', 'pdf']
    );
    assert.strictEqual(registry.classifyPath('/a/b/book.pdf'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.mobi'), 'convertible');
  });

  test('getAcknowledgedExtensions unions supported and convertible', () => {
    const registry = createRegistry(['mobi', 'pdf']);
    assert.deepStrictEqual(registry.getAcknowledgedExtensions().sort(), [
      'epub',
      'mobi',
      'pdf',
      'txt'
    ]);
  });

  test('defaults to supported/unknown when no convertible registered', () => {
    const registry = new BookFormatRegistry([createProvider('txt', ['txt'])]);
    assert.strictEqual(registry.classifyPath('/a/b/book.mobi'), 'unknown');
    assert.deepStrictEqual(registry.getAcknowledgedExtensions(), ['txt']);
  });
});

suite('createDefaultBookFormatRegistry app defaults', () => {
  test('pdf is natively supported; mobi/azw3 remain convertible', () => {
    const registry = createDefaultBookFormatRegistry();

    assert.strictEqual(registry.classifyPath('/a/b/book.txt'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.epub'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.pdf'), 'supported');
    assert.strictEqual(registry.classifyPath('/a/b/book.mobi'), 'convertible');
    assert.strictEqual(registry.classifyPath('/a/b/book.azw3'), 'convertible');
    assert.deepStrictEqual(registry.getSupportedExtensions().sort(), ['epub', 'pdf', 'txt']);
  });
});
