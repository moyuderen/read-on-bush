export const TXT_ENCODINGS = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'gb18030'] as const;
export type TxtEncoding = (typeof TXT_ENCODINGS)[number];

/** Undefined means inherit the global setting; auto is an explicit override. */
export function normalizeBookTxtEncoding(value: unknown): TxtEncoding | undefined {
  return typeof value === 'string' && TXT_ENCODINGS.includes(value as TxtEncoding)
    ? value as TxtEncoding
    : undefined;
}
