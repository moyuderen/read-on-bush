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

/**
 * 在 VS Code 进度通知中执行任务。
 * 提取动作本身是 async I/O（stat / read / parse），事件循环会自然让出，
 * 通知有足够机会渲染——无需额外 setTimeout 让出。
 */
export async function runWithProgressNotification<T>(
  title: string,
  task: () => Promise<T>
): Promise<T> {
  return window.withProgress(
    {
      location: ProgressLocation.Notification,
      title,
      cancellable: false
    },
    () => task()
  );
}

export async function importCachedBook<T>(options: {
  input: ImportBookInput;
  createBook(input: ImportBookInput): BookData;
  extract(filePath: string): Promise<T>;
  toChapterRefs(extraction: T): ChapterRef[];
  cache: ExtractionStore<T>;
  failurePrefix: string;
}): Promise<BookData> {
  const bookData = options.createBook(options.input);
  const displayName = options.input.displayName ?? `《${bookData.name}》`;

  try {
    const extraction = options.input.silent
      ? await options.extract(bookData.url)
      : await runWithProgressNotification(
          `正在导入${displayName}...`,
          () => options.extract(bookData.url)
        );
    bookData.chapters = options.toChapterRefs(extraction);
    const stat = await fs.promises.stat(bookData.url);
    await options.cache.set(bookData.id, stat.mtimeMs, extraction);
  } catch (error) {
    const text = error instanceof Error ? error.message : options.failurePrefix;
    message.warn(`${displayName}${text}，仍已加入书架`);
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
