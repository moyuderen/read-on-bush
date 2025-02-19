import { window, commands } from 'vscode';

export default function message(message = 'Hello World !!!', time = 3000) {
  window.showInformationMessage(message).then(() => {});
  // window.setStatusBarMessage('这条信息将在5秒后消失', 5000);
}

message.warn = (message = 'Hello World !!!') => {
  window.showWarningMessage(message);
};

message.error = (message = 'Hello World !!!') => {
  window.showErrorMessage(message);
};
