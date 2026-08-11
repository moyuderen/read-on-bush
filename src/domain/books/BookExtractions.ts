export type EpubImage = {
  zipPath: string;
  mediaType: string;
  charOffset: number;
};

export type EpubChapter = {
  title: string;
  text: string;
  images: EpubImage[];
};

export type EpubExtraction = {
  bookTitle: string;
  chapters: EpubChapter[];
};

export type PdfImageMeta = {
  index: number;
  width?: number;
  height?: number;
};

export type PdfPage = {
  title: string;
  text: string;
  images: PdfImageMeta[];
};

export type PdfExtraction = {
  bookTitle: string;
  pages: PdfPage[];
};
