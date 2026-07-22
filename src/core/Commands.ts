export enum Commands {
  OpenBook = 'readOnBush.openBook',
  DeleteBook = 'readOnBush.deleteEntry',
  RenameBook = 'readOnBush.renameBook',
  SetBookCategory = 'readOnBush.setBookCategory',
  ClearBookCategory = 'readOnBush.clearBookCategory',

  ImportBook = 'readOnBush.import',
  ImportBookDirectory = 'readOnBush.importDirectory',
  RefreshBookList = 'readOnBush.refreshBookList',
  SortBookList = 'readOnBush.sortBookList',
  SwitchBookListGroupBy = 'readOnBush.switchBookListGroupBy',
  PrevLine = 'readOnBush.prev',
  NextLine = 'readOnBush.next',
  JumpLine = 'readOnBush.jump',
  Start = 'readOnBush.start',
  Stop = 'readOnBush.stop',
  OpenTerminalCamouflage = 'readOnBush.openTerminalCamouflage',
  ToggleTerminalCamouflage = 'readOnBush.toggleTerminalCamouflage',

  SwitchReadingMode = 'readOnBush.switchReadingMode',
  SwitchCodingMode = 'readOnBush.switchCodingMode'
}

export enum CustomWhenClauseContext {
  IsReadingMode = 'readOnBush.isReadingMode'
}
