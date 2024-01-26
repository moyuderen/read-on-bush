import { window, commands} from 'vscode';

export default function message(message = 'Hello World !!!', time = 3000) {
  window.showInformationMessage(message).then(() => {
    
  });
}

message.error = (message = 'Hello World !!!') => {
  window.showErrorMessage(message);
};
