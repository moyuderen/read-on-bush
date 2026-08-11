export function getCharWidth(char: string): number {
  return /[^\x00-\xff]/.test(char) ? 2 : 1;
}
