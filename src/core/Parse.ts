const readline = require("linebyline");

export class Parse {
  public originContents: string[];
  public results: string[];
  public read: any;
  public lineWidth: number;

  constructor(public url: string) {
    this.url = url;
    this.originContents = [];
    this.results = [];
    this.lineWidth = 45;
    this.read = readline(url);
  }

  start(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.read
      .on("line", (line: string, lineCount: number, byteCount: number) => {
        if (line) {
          this.originContents.push(line);
        }
      })
      .on("error", (err: any) => {
        reject(err);
      });

      this.read.on("end", () => {
        const results: string[] = [];
        this.originContents.forEach((line: string) => {
          if (line.length < this.lineWidth) {
            results.push(line);
          } else {
            const count = Math.floor(line.length / this.lineWidth);
            for (let i = 0; i < count; i++) {
              results.push(line.substring(i * this.lineWidth, (i + 1) * this.lineWidth));
            }
          }
        });
        this.results = results;
        resolve(results);
      });
    });
  }
}

