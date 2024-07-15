export enum Commands {
  OpenBook = 'readOnBush.openBook',
  DeleteBook = 'readOnBush.deleteEntry',

  ImportBook = 'readOnBush.import',
  PrevLine = 'readOnBush.prev',
  NextLine = 'readOnBush.next',
  JumpLine = 'readOnBush.jump',
  Start = 'readOnBush.start',
  Stop = 'readOnBush.stop',

  SwitchReadingMode = 'readOnBush.switchReadingMode',
  SwitchCodingMode = 'readOnBush.switchCodingMode'
}

export enum CustomWhenClauseContext {
  IsReadingMode = 'readOnBush.isReadingMode'
}

export const isReadingMode = true;
