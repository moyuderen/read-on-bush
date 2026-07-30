import type { BookOutlineItem } from './BookOutline';

export type BookFormat = 'txt' | 'epub' | 'pdf' | 'mobi' | 'azw3' | (string & {});

export type ChapterRef = {
  title: string;
};

// epub 专用进度：章锚定 + 章内字符偏移（绑定源文本，不随显示配置漂）。
export type EpubProgress = {
  chapterIndex: number;
  charOffset: number;
};

// pdf 专用进度：页锚定 + 页内字符偏移。复用 epub 分页引擎——一页当作一个分页「章节」，
// 故结构同 EpubProgress（pageIndex ↔ chapterIndex），单独命名仅为语义清晰。
export type PdfProgress = {
  pageIndex: number;
  charOffset: number;
};

export type BookData = {
  id: string;
  name: string;
  process: number;
  url: string;
  children?: BookData[];
  category?: string;
  createdAt?: number;
  order?: number;
  format?: BookFormat;
  epubProgress?: EpubProgress;
  pdfProgress?: PdfProgress;
  chapters?: ChapterRef[];
};

export type { BookOutlineItem } from './BookOutline';
