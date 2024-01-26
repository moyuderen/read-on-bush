import { window, commands} from 'vscode';

export default function message(message = 'Hello World !!!', time = 3000) {
  window.showInformationMessage(message).then(() => {
    
  });
}

message.warn = (message = 'Hello World !!!') => {
  window.showWarningMessage(message);
};

message.error = (message = 'Hello World !!!') => {
  window.showErrorMessage(message);
};
