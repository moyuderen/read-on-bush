// pngjs 未自带类型声明，这里按 PdfExtractor 用到的子集做最小 ambient 声明。
declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      write(png: PNG, options?: unknown): Buffer;
      read(buffer: Buffer | Uint8Array, options?: unknown): PNG;
    };
  }
}
