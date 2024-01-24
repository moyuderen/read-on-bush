import { Memento, ExtensionContext} from 'vscode';

let storage: Memento;

export function setupStorage(context: ExtensionContext) {
  storage = context.globalState;
  context.globalState.setKeysForSync([

  ]);
}

export function getStorage(key: string) {
  let value: any = storage.get(key);
  try {
    return JSON.parse(value).value;
  } catch {
    return value;
  }
}

export function setStorage(key: string, value: any): void {
  const str = JSON.stringify({ value, type: typeof value });
  storage.update(key, str);
}

export function rmStorage(key: string): void {
  storage.update(key, undefined);
}
