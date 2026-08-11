import fs from 'fs';
import type { BookParser, BookParserOptions, TxtEncoding, TxtSearchSegment } from '.';
import { LineWidth } from '../../config/constants';

type DecoderEncoding = Exclude<TxtEncoding, 'auto'>;

type DetectionResult = {
  encoding: DecoderEncoding;
  bomLength: number;
  text: string;
};

const BOM_TABLE: ReadonlyArray<{ encoding: DecoderEncoding; bytes: number[] }> = [
  { encoding: 'utf-8', bytes: [0xef, 0xbb, 0xbf] },
  { encoding: 'utf-16le', bytes: [0xff, 0xfe] },
  { encoding: 'utf-16be', bytes: [0xfe, 0xff] }
];

function matchBom(bytes: Uint8Array): { encoding: DecoderEncoding; bomLength: number } | undefined {
  for (const { encoding, bytes: bom } of BOM_TABLE) {
    if (bom.every((byte, index) => bytes[index] === byte)) {
      return { encoding, bomLength: bom.length };
    }
  }
  return undefined;
}

function countCodePoints(text: string, predicate: (code: number) => boolean): number {
  let count = 0;
  for (let index = 0; index < text.length; ) {
    const code = text.codePointAt(index) ?? 0;
    if (predicate(code)) {
      count++;
    }
    index += code > 0xffff ? 2 : 1;
  }
  return count;
}

function isCjkCodePoint(code: number): boolean {
  return (
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff)
  );
}

/** 统计 CJK 字符数和总码位数，一次遍历完成。 */
function countCjkAndTotal(text: string): { cjk: number; total: number } {
  let cjk = 0;
  let total = 0;
  for (let index = 0; index < text.length; ) {
    const code = text.codePointAt(index) ?? 0;
    if (isCjkCodePoint(code)) {
      cjk++;
    }
    total++;
    index += code > 0xffff ? 2 : 1;
  }
  return { cjk, total };
}

function detectUtf16WithoutBom(bytes: Uint8Array): DecoderEncoding | undefined {
  if (bytes.length < 4 || bytes.length % 2 !== 0) {
    return undefined;
  }

  let evenZeroCount = 0;
  let oddZeroCount = 0;
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] === 0) {
      if (index % 2 === 0) {
        evenZeroCount++;
      } else {
        oddZeroCount++;
      }
    }
  }

  const threshold = Math.max(2, Math.ceil(bytes.length / 4));
  if (oddZeroCount >= threshold && evenZeroCount === 0) {
    return 'utf-16le';
  }
  if (evenZeroCount >= threshold && oddZeroCount === 0) {
    return 'utf-16be';
  }

  const littleEndianText = new TextDecoder('utf-16le').decode(bytes);
  const bigEndianText = new TextDecoder('utf-16be').decode(bytes);
  const littleEndianAstral = countCodePoints(littleEndianText, (code) => code > 0xffff);
  const bigEndianAstral = countCodePoints(bigEndianText, (code) => code > 0xffff);
  if (littleEndianAstral > bigEndianAstral) {
    return 'utf-16le';
  }
  if (bigEndianAstral > littleEndianAstral) {
    return 'utf-16be';
  }
  return undefined;
}

function isLikelyAmbiguousUtf16(bytes: Uint8Array): boolean {
  if (bytes.length < 2 || bytes.length % 2 !== 0) {
    return false;
  }

  let utf8Text: string;
  try {
    utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }

  // 一次遍历检查 UTF-8 解码结果：
  // - 含 CJK 字符 → 一定是 UTF-8
  // - 控制字符比例低 → 是普通文本（ASCII 字节对碰巧落入 CJK 码位不代表是 UTF-16）
  let cjkCount = 0;
  let controlCount = 0;
  let total = 0;
  for (let i = 0; i < utf8Text.length; ) {
    const code = utf8Text.codePointAt(i) ?? 0;
    total++;
    if (isCjkCodePoint(code)) {
      cjkCount++;
    } else if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      controlCount++;
    }
    i += code > 0xffff ? 2 : 1;
  }

  if (cjkCount > 0 || total === 0 || controlCount / total < 0.05) {
    return false;
  }

  // UTF-16 LE/BE 双向 CJK 密度都高 → 无法判断大小端序
  const little = countCjkAndTotal(new TextDecoder('utf-16le').decode(bytes));
  const big = countCjkAndTotal(new TextDecoder('utf-16be').decode(bytes));

  return (
    little.cjk >= 1 &&
    big.cjk >= 1 &&
    little.cjk / little.total >= 0.5 &&
    big.cjk / big.total >= 0.5
  );
}

function detectEncoding(bytes: Uint8Array, requested: TxtEncoding): DetectionResult {
  if (requested !== 'auto') {
    const bom = matchBom(bytes);
    const bomLength = bom?.encoding === requested ? bom.bomLength : 0;
    const text = new TextDecoder(requested).decode(bytes.subarray(bomLength));
    return { encoding: requested, bomLength, text };
  }

  const bom = matchBom(bytes);
  if (bom) {
    const text = new TextDecoder(bom.encoding).decode(bytes.subarray(bom.bomLength));
    return { encoding: bom.encoding, bomLength: bom.bomLength, text };
  }

  if (isLikelyAmbiguousUtf16(bytes)) {
    throw new Error(
      '无法自动识别无 BOM 的 UTF-16 文本，请将 readOnBush.txtEncoding 设置为 utf-16le 或 utf-16be'
    );
  }

  const utf16Encoding = detectUtf16WithoutBom(bytes);
  if (utf16Encoding) {
    const text = new TextDecoder(utf16Encoding).decode(bytes);
    return { encoding: utf16Encoding, bomLength: 0, text };
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { encoding: 'utf-8', bomLength: 0, text };
  } catch {
    const text = new TextDecoder('gb18030').decode(bytes);
    return { encoding: 'gb18030', bomLength: 0, text };
  }
}

export class TxtParser implements BookParser {
  private readonly lineWidth: number;
  private readonly encoding: TxtEncoding;

  constructor(public url: string, options: BookParserOptions = {}) {
    this.url = url;
    this.lineWidth = options.lineWidth ?? LineWidth.Default;
    this.encoding = options.encoding ?? 'auto';
  }

  async readContent(): Promise<string[]> {
    const segments = await this.readSearchSegments();
    return segments.map((segment) => segment.text);
  }

  async readSearchSegments(): Promise<TxtSearchSegment[]> {
    const bytes = new Uint8Array(await fs.promises.readFile(this.url));
    const { text } = detectEncoding(bytes, this.encoding);
    const results: TxtSearchSegment[] = [];

    let start = 0;
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code !== 10 && code !== 13) {
        continue;
      }
      this.appendSearchLineSegments(results, text.slice(start, index), '\n');
      if (code === 13 && text.charCodeAt(index + 1) === 10) {
        index++;
      }
      start = index + 1;
    }
    this.appendSearchLineSegments(results, text.slice(start), '');

    return results;
  }

  private appendSearchLineSegments(
    results: TxtSearchSegment[],
    segment: string,
    finalSeparator: string
  ): void {
    if (!segment) {
      if (finalSeparator && results.length > 0) {
        results[results.length - 1].separator += finalSeparator;
      }
      return;
    }

    for (let i = 0; i < segment.length; i += this.lineWidth) {
      results.push({
        text: segment.slice(i, Math.min(i + this.lineWidth, segment.length)),
        separator: i + this.lineWidth < segment.length ? '' : finalSeparator
      });
    }
  }

}
