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

  EpubNext = 'readOnBush.epub.next',
  EpubPrev = 'readOnBush.epub.prev',
  EpubJumpChapter = 'readOnBush.epub.jumpChapter',
  EpubStop = 'readOnBush.epub.stop',
  EpubViewImage = 'readOnBush.epub.viewImage',

  PdfNext = 'readOnBush.pdf.next',
  PdfPrev = 'readOnBush.pdf.prev',
  PdfJumpPage = 'readOnBush.pdf.jumpPage',
  PdfStop = 'readOnBush.pdf.stop',
  PdfViewImage = 'readOnBush.pdf.viewImage',

  OpenBookOutline = 'readOnBush.openBookOutline',

  SwitchReadingMode = 'readOnBush.switchReadingMode',
  SwitchCodingMode = 'readOnBush.switchCodingMode'
}

export enum CustomWhenClauseContext {
  IsReadingMode = 'readOnBush.isReadingMode'
}
