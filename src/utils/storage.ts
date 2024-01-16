import { Memento} from 'vscode';
import { ReadBook, type Plugin } from '../core/ReadBook';

let storage: Memento;

function init(app: ReadBook) {
  storage = app.context.globalState;
  app.context.globalState.setKeysForSync([

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

export default {
  install(app: ReadBook) {
    init(app);
    return app;
  },
  getStorage,
  setStorage,
  rmStorage
};
