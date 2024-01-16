import { window } from 'vscode';

export default function message(message = 'Hello World !!!') {
  window.showInformationMessage(message);
}
