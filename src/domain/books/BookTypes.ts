import type { BookOutlineItem } from './BookOutline';

export type BookFormat = 'txt' | 'epub' | 'pdf' | 'mobi' | 'azw3' | (string & {});

export type ChapterRef = {
  title: string;
};

// epub 专用进度：章锚定 + 章内字符偏移（绑定源文本，不随显示配置漂）。
// 未来若引入通用进度模型（PDF 页码 / 定位符等），再在此扩展。
export type EpubProgress = {
  chapterIndex: number;
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
  chapters?: ChapterRef[];
};

export type { BookOutlineItem } from './BookOutline';
