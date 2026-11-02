import {
  DEFAULT_READER_KEYBINDINGS,
  type ReaderKeybindings,
  type ReaderAction
} from '../../config/readerKeybindings';

export const CAMOUFLAGE_INPUT_KEYS = Object.values(DEFAULT_READER_KEYBINDINGS);

export type CamouflageInputHandlers = {
  next: () => void;
  prev: () => void;
  jump: () => void;
  search?: () => void;
  toggleDebug: () => void;
  toggleAutoTurn?: () => void;
  quit: () => void;
  viewImage?: () => void;
  onNonQuitKey?: () => void;
};

export function handleCamouflageInput(
  data: string,
  handlers: CamouflageInputHandlers,
  keys: ReaderKeybindings = DEFAULT_READER_KEYBINDINGS
): void {
  let action: ReaderAction | undefined;
  if (data === '\x1b[C') {
    action = 'next';
  } else if (data === '\x1b[D') {
    action = 'prev';
  } else if (data.length === 1) {
    action = (Object.keys(keys) as ReaderAction[]).find(
      (candidate) => keys[candidate] === data.toLowerCase()
    );
  }
  if (!action) {
    return;
  }
  if (action !== 'quit') {
    handlers.onNonQuitKey?.();
  }
  handlers[action]?.();
}
