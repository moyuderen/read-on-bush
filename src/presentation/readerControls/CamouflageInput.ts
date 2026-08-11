export const CAMOUFLAGE_INPUT_KEYS = ['n', 'p', 'j', 'i', 'd', 'f', 'a', 'q'] as const;

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

export function handleCamouflageInput(data: string, handlers: CamouflageInputHandlers): void {
  const key = normalizeCamouflageInput(data);

  if (!key) {
    return;
  }

  handleCamouflageKey(key, handlers);
}

function normalizeCamouflageInput(data: string): string | undefined {
  if (data === '\x1b[C') {
    return 'n';
  }

  if (data === '\x1b[D') {
    return 'p';
  }

  const key = data.toLowerCase();
  return key.length === 1 ? key : undefined;
}

function handleCamouflageKey(key: string, handlers: CamouflageInputHandlers): void {
  if (key === 'n') {
    handlers.onNonQuitKey?.();
    handlers.next();
    return;
  }

  if (key === 'p') {
    handlers.onNonQuitKey?.();
    handlers.prev();
    return;
  }

  if (key === 'j') {
    handlers.onNonQuitKey?.();
    handlers.jump();
    return;
  }

  if (key === 'i') {
    handlers.onNonQuitKey?.();
    handlers.viewImage?.();
    return;
  }

  if (key === 'f') {
    handlers.onNonQuitKey?.();
    handlers.search?.();
    return;
  }

  if (key === 'd') {
    handlers.onNonQuitKey?.();
    handlers.toggleDebug();
    return;
  }

  if (key === 'a') {
    handlers.onNonQuitKey?.();
    handlers.toggleAutoTurn?.();
    return;
  }

  if (key === 'q') {
    handlers.quit();
  }
}
