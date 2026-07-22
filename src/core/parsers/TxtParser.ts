import type { BookParser, BookParserOptions } from '.';
import { LineWidth } from '../config';

const readline = require('linebyline');

export class TxtParser implements BookParser {
  private readonly lineWidth: number;

  constructor(public url: string, options: BookParserOptions = {}) {
    this.url = url;
    this.lineWidth = options.lineWidth ?? LineWidth.Default;
  }

  readContent(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = [];
      const read = readline(this.url);

      read
        .on('line', (line: string) => {
          if (line) {
            this.appendSplitLine(results, line);
          }
        })
        .on('error', (err: any) => {
          reject(err);
        });

      read.on('end', () => {
        resolve(results);
      });
    });
  }

  private appendSplitLine(results: string[], line: string): void {
    if (line.length <= this.lineWidth) {
      results.push(line);
      return;
    }

    const count = Math.ceil(line.length / this.lineWidth);
    for (let i = 0; i < count; i++) {
      const content = line.substring(i * this.lineWidth, (i + 1) * this.lineWidth);
      results.push(content);
    }
  }
}
