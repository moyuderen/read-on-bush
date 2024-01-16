import * as vscode from 'vscode';
import { commands, window, StatusBarAlignment, StatusBarItem, workspace } from "vscode";
import json from './json';
import storage from './utils/storage';
import message from './utils/message';
import './core/BookTree';

// 全局变量
let readingBookLine = 0;
let readingBookId = '';

function getBook(readingBookId: string) {
  const { list = [], pageIndex = 0 } = storage.getStorage(readingBookId);
}

function setBook(context: vscode.ExtensionContext) {
  let importStatusBarItem: StatusBarItem;
  let command = "readOnBush.import";
  importStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 60);
  importStatusBarItem.text = '$(add)';
  importStatusBarItem.tooltip = '导入';
  importStatusBarItem.command = command;
  importStatusBarItem.show();
  context.subscriptions.push(importStatusBarItem);
  commands.registerCommand(command, () => {
    window.showOpenDialog({
      title: "选择书籍txt",
      filters: {
        'file': ['txt']
      },
    }).then(file => {
        if (file && file.length > 0) {
          loadFile(file[0].path);
        }
    });
  });
}


function loadFile(filePath: string) {
  // filePath 文件在电脑上的目录
  console.log(filePath);
  message(filePath);
}

function getBooks() {
  const books = storage.getStorage(readingBookId);
}


export default function init(context: vscode.ExtensionContext) {

  setBook(context);
  
  let lineIndex = 0;

  let contentBarItem: any;
  contentBarItem = window.createStatusBarItem();
  // contentBarItem.command = command;
  context.subscriptions.push(contentBarItem);
  contentBarItem.text = json[lineIndex];
  contentBarItem.tooltip = '文档内容...';
  contentBarItem.show();

  function update() {
    contentBarItem.text = json[lineIndex];
    contentBarItem.tooltip = json[lineIndex];
  }


  let commandPrev = "readOnBush.prev";

  let preStatusBarItem;
  preStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 70);
  preStatusBarItem.command = commandPrev;
  context.subscriptions.push(preStatusBarItem);
  preStatusBarItem.text = `$(chevron-left)`;
  preStatusBarItem.tooltip = '上一章';
  preStatusBarItem.show();

  vscode.commands.registerCommand('readOnBush.prev', () => {
    if(lineIndex < 1) {
      vscode.window.showInformationMessage('已经是第一页了');
      return;
    }
    lineIndex --;
    update();
  });


  let commandNext = "readOnBush.next";
  let nextStatusBarItem;
  nextStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 70);
  nextStatusBarItem.command = commandNext;
  context.subscriptions.push(nextStatusBarItem);
  nextStatusBarItem.text = `$(chevron-right)`;
  nextStatusBarItem.tooltip = '下一章';
  nextStatusBarItem.show();

  vscode.commands.registerCommand('readOnBush.next', () => {
    if(lineIndex > json.length) {
      vscode.window.showInformationMessage('已经阅读完啦');
      return;
    }
    lineIndex ++;
    update();
  });
}
