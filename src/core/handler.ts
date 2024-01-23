import { type ExtensionContext, type StatusBarItem, StatusBarAlignment,  window, commands } from 'vscode';
import { BookData, Book } from './Book';
import { readingBook } from './BookList';
import { setupKeyBindingsBarItem, activeBarItem, disableBarItem } from './keyBindingHandler';
import { StatusBarPriority } from './config';
import { Commands } from './Commands';

export let contentBarItem: StatusBarItem;
export let preStatusBarItem: StatusBarItem;
export let nextStatusBarItem: StatusBarItem;
export let startStatusBarItem: StatusBarItem;
export let stopStatusBarItem: StatusBarItem;
export let processStatusBarItem: StatusBarItem;


function viewContent(context: ExtensionContext) {
  if(!contentBarItem) {
    contentBarItem = window.createStatusBarItem();
    context.subscriptions.push(contentBarItem);
  }
  updateContent('Please select the book you want to read !');
  contentBarItem.show();
}

export function updateContent(content: string) {
  contentBarItem.text = content;
  contentBarItem.tooltip = content;
}


function preLine(context: ExtensionContext) {
  if(!preStatusBarItem) {
    let commandPrev = "readOnBush.prev";
    preStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.PrevLine);
    preStatusBarItem.command = commandPrev;
    context.subscriptions.push(preStatusBarItem);
    preStatusBarItem.text = `$(chevron-left)`;
    preStatusBarItem.tooltip = 'Prev line';
    preStatusBarItem.show();
    commands.registerCommand('readOnBush.prev', () => {
      if(readingBook) {
        readingBook.prevLine();
      }
    });
  }
}

function nextLine(context: ExtensionContext) {
  if(!nextStatusBarItem) {
    let commandNext = "readOnBush.next";
    nextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.NextLine);
    nextStatusBarItem.command = commandNext;
    context.subscriptions.push(nextStatusBarItem);
    nextStatusBarItem.text = `$(chevron-right)`;
    nextStatusBarItem.tooltip = 'Next line';
    nextStatusBarItem.show();

    commands.registerCommand('readOnBush.next', () => {
      if(readingBook) {
        readingBook.nextLine();
      }
    });
  }
}

function start(context: ExtensionContext) {
  if(!startStatusBarItem) {
    startStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Start);
    startStatusBarItem.command = 'readOnBush.start';
    context.subscriptions.push(startStatusBarItem);
    startStatusBarItem.text = `$(run)`;
    startStatusBarItem.tooltip = 'Start';
    // startStatusBarItem.show();

    commands.registerCommand('readOnBush.start', () => {
      startStatusBarItem.hide();
      stopStatusBarItem.show();
      contentBarItem.show();
      preStatusBarItem.show();
      nextStatusBarItem.show();
      processStatusBarItem.show();
    });
  }
}

function stop(context: ExtensionContext) {
  if(!stopStatusBarItem) {
    stopStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Stop);
    stopStatusBarItem.command = 'readOnBush.end';
    context.subscriptions.push(stopStatusBarItem);
    stopStatusBarItem.text = `$(debug-stop)`;
    stopStatusBarItem.tooltip = 'Stop';
    stopStatusBarItem.show();

    commands.registerCommand('readOnBush.end', () => {
      startStatusBarItem.show();
      stopStatusBarItem.hide();
      contentBarItem.hide();
      preStatusBarItem.hide();
      nextStatusBarItem.hide();
      processStatusBarItem.hide();
      disableBarItem.show();
      activeBarItem.hide();
      commands.executeCommand(Commands.DisableKeyBinding);
    });
  }
}


function process(context: ExtensionContext) {
  if(!processStatusBarItem) {
    processStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, StatusBarPriority.Process);
    context.subscriptions.push(processStatusBarItem);
    processStatusBarItem.text = '';
    processStatusBarItem.show();
  }
}

export function updateProcess(cur: number, total: number, book: BookData) {
  processStatusBarItem.text = `${cur}/${total}`;
  processStatusBarItem.tooltip = `《${book.name}》of progress...`;
}

export function setupHandler(context: ExtensionContext) {
  setupKeyBindingsBarItem(context);
  
  viewContent(context);
  preLine(context);
  nextLine(context);
  start(context);
  stop(context);
  process(context);
}