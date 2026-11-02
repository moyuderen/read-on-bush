import { DEFAULT_READER_KEYBINDINGS, formatReaderKeyHints } from '../../config/readerKeybindings';
import { getReaderKeybindings } from '../../config/settings';

export const KEY_HINT_LABELS = formatReaderKeyHints(DEFAULT_READER_KEYBINDINGS);
export const KEYS_HINT = `keys: ${KEY_HINT_LABELS}`;
export const CLAUDE_CLI_SHORTCUT_HINT = `  ⎿  ${KEY_HINT_LABELS}`;

export function getKeysHint(): string {
  return `keys: ${formatReaderKeyHints(getReaderKeybindings())}`;
}

export function getClaudeCliShortcutHint(): string {
  return `  ⎿  ${formatReaderKeyHints(getReaderKeybindings())}`;
}
