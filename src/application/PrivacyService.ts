import path from 'path';
import type { BookData } from '../domain/books';
import type {
  ResolvedTerminalTemplate,
  TerminalTemplate
} from '../presentation/readerTemplates';
import { getPrivacyDisplayOnStart } from '../config/settings';

export type PrivacyDisplayMode = 'normal' | 'private';

export function getBookDisplayName(book: BookData, mode: PrivacyDisplayMode): string {
  if (mode === 'normal') {
    return book.name;
  }

  return book.privacyAlias?.trim() || `Book ${book.id.slice(0, 6)}`;
}

export function getBookMessageName(book: BookData, mode: PrivacyDisplayMode): string {
  return mode === 'private' ? '文档' : `《${book.name}》`;
}

export function getBookTooltip(book: BookData, mode: PrivacyDisplayMode): string {
  if (mode === 'private') {
    return getBookDisplayName(book, mode);
  }

  const fileName = path.basename(book.url);
  const format = book.format?.toUpperCase() || path.extname(book.url).slice(1).toUpperCase();
  return format ? `文件：${fileName}\n格式：${format}` : `文件：${fileName}`;
}

export class PrivacyService {
  private mode: PrivacyDisplayMode;
  private readonly privateTerminalTemplates = new WeakMap<
    TerminalTemplate,
    ResolvedTerminalTemplate
  >();

  constructor() {
    this.mode = getPrivacyDisplayOnStart() ? 'private' : 'normal';
  }

  get currentMode(): PrivacyDisplayMode {
    return this.mode;
  }

  get isPrivate(): boolean {
    return this.mode === 'private';
  }

  setMode(mode: PrivacyDisplayMode): PrivacyDisplayMode {
    this.mode = mode;
    return this.mode;
  }

  getBookDisplayName(book: BookData): string {
    return getBookDisplayName(book, this.mode);
  }

  getBookMessageName(book: BookData): string {
    return getBookMessageName(book, this.mode);
  }

  getImageTitle(book: BookData): string {
    return `${this.getBookMessageName(book)}图片`;
  }

  applyTerminalPrivacy(template: ResolvedTerminalTemplate): ResolvedTerminalTemplate {
    if (!this.isPrivate) {
      return template;
    }

    const cached = this.privateTerminalTemplates.get(template.template);
    if (cached?.key === template.key) {
      return cached;
    }

    const privateTemplate = {
      ...template,
      template: {
        ...template.template,
        terminalName: 'Terminal'
      }
    };
    this.privateTerminalTemplates.set(template.template, privateTemplate);
    return privateTemplate;
  }
}
