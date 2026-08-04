import * as assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TxtParser } from '../../core/parsers/TxtParser';

async function withTempFile(bytes: Uint8Array, test: (filePath: string) => Promise<void>) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'read-on-bush-txt-'));
  const filePath = path.join(directory, 'book.txt');
  try {
    await fs.promises.writeFile(filePath, bytes);
    await test(filePath);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

suite('TxtParser', () => {
  test('decodes GB18030 text used by common Windows TXT files', async () => {
    const gb18030Bytes = Buffer.concat([
      Buffer.from('ascii prefix: '),
      Buffer.from([0xc4, 0xe3, 0xba, 0xc3, 0x0a])
    ]);

    await withTempFile(gb18030Bytes, async (filePath) => {
      const content = await new TxtParser(filePath).readContent();

      assert.deepStrictEqual(content, ['ascii prefix: 你好']);
    });
  });

  test('allows forcing GB18030 when automatic detection is ambiguous', async () => {
    await withTempFile(Buffer.from([0xc3, 0xa9]), async (filePath) => {
      const content = await new TxtParser(filePath, { encoding: 'gb18030' }).readContent();

      assert.deepStrictEqual(content, ['茅']);
    });
  });

  test('detects UTF-16 text without a BOM', async () => {
    // 混合 ASCII + CJK：ASCII 字符的 UTF-16 高字节为 0x00，为零字节检测提供足够信号
    const text = 'Chapter 1 你好\nChapter 2 世界';
    const utf16le = Buffer.from(text, 'utf16le');
    const utf16be = Buffer.from(utf16le);
    for (let index = 0; index < utf16be.length; index += 2) {
      const first = utf16be[index];
      utf16be[index] = utf16be[index + 1];
      utf16be[index + 1] = first;
    }

    await withTempFile(utf16le, async (filePath) => {
      assert.deepStrictEqual(await new TxtParser(filePath).readContent(), [
        'Chapter 1 你好',
        'Chapter 2 世界'
      ]);
    });
    await withTempFile(utf16be, async (filePath) => {
      assert.deepStrictEqual(await new TxtParser(filePath).readContent(), [
        'Chapter 1 你好',
        'Chapter 2 世界'
      ]);
    });
  });

  test('asks for an explicit encoding for ambiguous BOM-less UTF-16 text', async () => {
    // 纯 CJK 文本（无 ASCII）不会产生零字节，大小端无法自动判断
    const text = '你好世界';
    await withTempFile(Buffer.from(text, 'utf16le'), async (filePath) => {
      await assert.rejects(
        new TxtParser(filePath).readContent(),
        /无法自动识别无 BOM 的 UTF-16/
      );
      assert.deepStrictEqual(
        await new TxtParser(filePath, { encoding: 'utf-16le' }).readContent(),
        [text]
      );
    });
  });

  test('keeps a long line instead of truncating it at 4096 bytes', async () => {
    const line = 'a'.repeat(5000);

    await withTempFile(Buffer.from(line), async (filePath) => {
      const content = await new TxtParser(filePath, { lineWidth: 10000 }).readContent();

      assert.deepStrictEqual(content, [line]);
    });
  });

  test('detects UTF-8 after a long ASCII prefix', async () => {
    const line = `${'a'.repeat(70000)}你好`;

    await withTempFile(Buffer.from(line), async (filePath) => {
      const content = await new TxtParser(filePath, { lineWidth: 100000 }).readContent();

      assert.deepStrictEqual(content, [line]);
    });
  });
});
