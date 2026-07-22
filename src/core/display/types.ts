import type { BookData } from '../Book';

export type ReadingDisplayState = {
  content: string;
  contents: string[];
  book: BookData;
  process: number;
  total: number;
  isReading: boolean;
};
