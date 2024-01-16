import { type ExtensionContext, type StatusBarItem, StatusBarAlignment,  window, commands } from 'vscode';
import { ReadBook } from './ReadBook';
import { Parse } from './Parse';
import message from '../utils/message';
import { BookList } from './BookList';

export type BookData = {
  id: string
  name: string
  process: number
  url: string
  children?: BookData[]
};

let contentBarItem: StatusBarItem;
let preStatusBarItem: StatusBarItem;
let nextStatusBarItem: StatusBarItem;
let startStatusBarItem: StatusBarItem;
let stopStatusBarItem: StatusBarItem;
let processStatusBarItem: StatusBarItem;

function process(context: ExtensionContext) {
  if(!processStatusBarItem) {
    processStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 90);
    context.subscriptions.push(processStatusBarItem);
    processStatusBarItem.text = '加载中...';
    processStatusBarItem.show();
  }
}

function updateProcess(cur: number, total: number, book: BookData) {
  processStatusBarItem.text = `${cur}/${total}`;
  processStatusBarItem.tooltip = `《${book.name}》进度...`;
}

function viewContent(context: ExtensionContext) {
  if(!contentBarItem) {
    contentBarItem = window.createStatusBarItem();
    context.subscriptions.push(contentBarItem);
  }
  updateContent('加载内容中，请耐心等待...');
  contentBarItem.show();
}

function updateContent(content: string) {
  contentBarItem.text = content;
  contentBarItem.tooltip = content;
}


function preLine(context: ExtensionContext, cb: Function) {
  if(!preStatusBarItem) {
    let commandPrev = "readOnBush.prev";
    preStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 90);
    preStatusBarItem.command = commandPrev;
    context.subscriptions.push(preStatusBarItem);
    preStatusBarItem.text = `$(chevron-left)`;
    preStatusBarItem.tooltip = 'Prev line';
    preStatusBarItem.show();
    commands.registerCommand('readOnBush.prev', () => {
      cb();
    });
  }
}

function nextLine(context: ExtensionContext, cb: Function) {
  if(!nextStatusBarItem) {
    let commandNext = "readOnBush.next";
    nextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 70);
    nextStatusBarItem.command = commandNext;
    context.subscriptions.push(nextStatusBarItem);
    nextStatusBarItem.text = `$(chevron-right)`;
    nextStatusBarItem.tooltip = 'Next line';
    nextStatusBarItem.show();

    commands.registerCommand('readOnBush.next', () => {
      cb();
    });
  }
}

function start(context: ExtensionContext) {
  if(!startStatusBarItem) {
    startStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 90);
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
     stopStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 80);
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
    });
  }
}

export class Book {
  public context: ExtensionContext;
  public bookList: BookList;
  public book: BookData;
  public contents: string[];

  constructor(context: ExtensionContext, book: BookData, bookList: BookList) {
    this.context = context;
    this.bookList = bookList;
    this.book = book;
    this.contents = [];
    viewContent(context);
    process(context);
    preLine(context, () => this.prevLine());
    start(context);
    stop(context);
    nextLine(context, () => this.nextLine());
    const parse = new Parse(book.url);
    this.init(parse);
  }

  async init(parse: Parse) {
    const contents: string[] = await parse.start();
    this.contents = contents;
    const content = contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
  }

  prevLine() {
    if(this.book.process < 1) {
      message('已经是第一页了');
      return; 
    }
    this.book.process --;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
    this.bookList.updateBookList(this.book.id, this.book.process);
  }

  nextLine() {
     if(this.book.process >= this.contents.length) {
      message('已经是最后一页了');
      return; 
    }
    this.book.process ++;
    const content = this.contents[this.book.process];
    updateContent(content);
    updateProcess(this.book.process, this.contents.length, this.book);
    this.bookList.updateBookList(this.book.id, this.book.process);
  }
}