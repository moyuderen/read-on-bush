import fs from 'fs';
import { ProgressLocation, window } from 'vscode';
import message from '../utils/message';
import type {
  BookData,
  BookOutlineItem,
  ChapterRef
} from '../domain/books';
import type { ImportBookInput } from './BookFormat';
import type { ExtractionStore } from './CachedExtractionLoader';

export async function importCachedBook<T>(options: {
  input: ImportBookInput;
  createBook(input: ImportBookInput): BookData;
  extract(filePath: string): Promise<T>;
  toChapterRefs(extraction: T): ChapterRef[];
  cache: ExtractionStore<T>;
  failurePrefix: string;
}): Promise<BookData> {
  const bookData = options.createBook(options.input);

  try {
    const extraction = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `正在导入《${bookData.name}》...`,
        cancellable: false
      },
      async () => {
        // 先让出事件循环，确保 VS Code 有机会渲染进度通知后再开始同步解析。
        await new Promise(resolve => setTimeout(resolve));
        return options.extract(bookData.url);
      }
    );
    bookData.chapters = options.toChapterRefs(extraction);
    const stat = await fs.promises.stat(bookData.url);
    await options.cache.set(bookData.id, stat.mtimeMs, extraction);
  } catch (error) {
    const text = error instanceof Error ? error.message : options.failurePrefix;
    message.warn(`《${bookData.name}》${text}，仍已加入书架`);
  }

  return bookData;
}

export function createBookOutline(book: BookData): BookOutlineItem[] {
  return (book.chapters ?? []).map((chapter, index) => ({
    id: `${book.id}:section:${index}`,
    title: chapter.title,
    target: { kind: 'section', sectionIndex: index }
  }));
}
