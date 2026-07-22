import type { BookParser } from '.';

const readline = require('linebyline');

export class TxtParser implements BookParser {
  constructor(public url: string, private readonly lineWidth = 45) {
    this.url = url;
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
