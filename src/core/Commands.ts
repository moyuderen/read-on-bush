import { AppName } from "./config";

export enum Commands {
  ImportBook = `${AppName}.import`,
  ActiveKeyBinding = `${AppName}.activeKeyBinding`,
  DisableKeyBinding = `${AppName}.disableKeyBinding`
}

export enum CustomWhenClauseContext {
  KeyBindingsStatus = `${AppName}.keyBindingsStatus`
}