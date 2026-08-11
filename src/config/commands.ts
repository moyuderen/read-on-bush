export enum Commands {
  OpenBook = 'readOnBush.openBook',
  DeleteBook = 'readOnBush.deleteEntry',
  RenameBook = 'readOnBush.renameBook',
  SetBookCategory = 'readOnBush.setBookCategory',
  ClearBookCategory = 'readOnBush.clearBookCategory',
  SetPrivacyAlias = 'readOnBush.setPrivacyAlias',
  TogglePrivacyDisplay = 'readOnBush.togglePrivacyDisplay',
  EnablePrivacyDisplay = 'readOnBush.enablePrivacyDisplay',
  DisablePrivacyDisplay = 'readOnBush.disablePrivacyDisplay',
  CreateCategory = 'readOnBush.createCategory',
  RenameCategory = 'readOnBush.renameCategory',

  ImportBook = 'readOnBush.import',
  ImportBookDirectory = 'readOnBush.importDirectory',
  RefreshBookList = 'readOnBush.refreshBookList',
  SortBookList = 'readOnBush.sortBookList',
  SwitchBookListGroupBy = 'readOnBush.switchBookListGroupBy',
  SearchBook = 'readOnBush.searchBook',
  SearchCurrentBook = 'readOnBush.searchCurrentBook',
  SearchBack = 'readOnBush.searchBack',
  PrevLine = 'readOnBush.prev',
  NextLine = 'readOnBush.next',
  JumpLine = 'readOnBush.jump',
  Start = 'readOnBush.start',
  Stop = 'readOnBush.stop',
  OpenTerminalCamouflage = 'readOnBush.openTerminalCamouflage',
  ToggleTerminalCamouflage = 'readOnBush.toggleTerminalCamouflage',
  OpenCustomTemplateEditor = 'readOnBush.openCustomTemplateEditor',

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

  ClearCache = 'readOnBush.clearCache',
  ContinueReading = 'readOnBush.continueReading',
  RemoveFromRecent = 'readOnBush.removeFromRecent',

  SwitchReadingMode = 'readOnBush.switchReadingMode',
  SwitchCodingMode = 'readOnBush.switchCodingMode',

  AutoTurnToggle = 'readOnBush.autoTurn.toggle'
}

export enum CustomWhenClauseContext {
  IsReadingMode = 'readOnBush.isReadingMode',
  IsTxtReading = 'readOnBush.isTxtReading',
  IsPrivacyDisplay = 'readOnBush.isPrivacyDisplay'
}
