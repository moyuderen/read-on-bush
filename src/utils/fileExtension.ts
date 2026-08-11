import path from 'path';

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}
