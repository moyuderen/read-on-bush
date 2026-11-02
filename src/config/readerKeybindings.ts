export const DEFAULT_READER_KEYBINDINGS = {
  next: 'n',
  prev: 'p',
  jump: 'j',
  viewImage: 'i',
  toggleDebug: 'd',
  search: 'f',
  toggleAutoTurn: 'a',
  quit: 'q'
} as const;

export type ReaderAction = keyof typeof DEFAULT_READER_KEYBINDINGS;
export type ReaderKeybindings = Record<ReaderAction, string>;

// Resolve the whole map atomically: a conflicting override must never shadow
// another action, especially the emergency conceal/quit key.
export function resolveReaderKeybindings(value: unknown): ReaderKeybindings {
  const result: ReaderKeybindings = { ...DEFAULT_READER_KEYBINDINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }
  for (const action of Object.keys(result) as ReaderAction[]) {
    const key = (value as Record<string, unknown>)[action];
    if (key === undefined) {
      continue;
    }
    if (typeof key !== 'string' || !/^[!-~]$/.test(key)) {
      return { ...DEFAULT_READER_KEYBINDINGS };
    }
    result[action] = key.toLowerCase();
  }
  if (new Set(Object.values(result)).size !== Object.keys(result).length) {
    return { ...DEFAULT_READER_KEYBINDINGS };
  }
  return result;
}

export function formatReaderKeyHints(keys: ReaderKeybindings): string {
  return `${keys.quit} hide · ${keys.quit}${keys.quit} quit · ${keys.toggleDebug} toggle · ${keys.next}/${keys.prev} step · ${keys.jump} jump · ${keys.viewImage} image · ${keys.search} search · ${keys.toggleAutoTurn} auto`;
}
