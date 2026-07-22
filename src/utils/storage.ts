import { type Memento, type ExtensionContext } from 'vscode';

type StoredValue<T> = {
  value: T;
  type: string;
};

let storage: Memento | undefined;

function getStorageInstance(): Memento {
  if (!storage) {
    throw new Error('Storage has not been initialized');
  }

  return storage;
}

export function setupStorage(context: ExtensionContext): void {
  storage = context.globalState;
  context.globalState.setKeysForSync([]);
}

export function getStorage<T = unknown>(key: string): T | undefined {
  const value = getStorageInstance().get<string | T>(key);

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return (JSON.parse(value) as StoredValue<T>).value;
  } catch {
    return value as T;
  }
}

export function setStorage<T>(key: string, value: T): void {
  const str = JSON.stringify({ value, type: typeof value });
  void getStorageInstance().update(key, str);
}

export function rmStorage(key: string): void {
  void getStorageInstance().update(key, undefined);
}
