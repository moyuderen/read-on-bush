import { ANSI_BLUE, ANSI_CYAN, ANSI_DIM, ANSI_GREEN, ANSI_RED, ANSI_YELLOW, paint } from './AnsiTemplate';
import type { TerminalTemplate } from './TemplateTypes';

export const buildLogTemplate: TerminalTemplate = {
  terminalName: 'npm: watch',
  contentPrefix: '[12:42:13] info  ',
  header: [
    paint('> npm run watch', ANSI_BLUE),
    '',
    paint('[12:41:07] Starting compilation in watch mode...', ANSI_DIM),
    paint('[12:41:08] File change detected. Starting incremental compilation...', ANSI_CYAN),
    paint('[12:41:08] Found 0 errors. Watching for file changes.', ANSI_GREEN),
    '',
    'assets by status 128 KiB [cached] 14 assets',
    'runtime modules 3.12 KiB 6 modules',
    'orphan modules 9.61 KiB [orphan] 4 modules',
    'cacheable modules 48.7 KiB',
    '  ./src/extension.ts 2.18 KiB [built] [code generated]',
    '  ./src/presentation/reader/CamouflageRenderer.ts 12.4 KiB [built] [code generated]',
    '  ./src/formats/epub/EpubProvider.ts 4.91 KiB [built]',
    '',
    paint('WARNING in ./src/presentation/reader/index.ts 36:12-28', ANSI_YELLOW),
    paint('export refreshDisplay was not found in ./TxtCamouflageDisplay', ANSI_YELLOW),
    ''
  ],
  trailing: [
    '',
    paint('[12:42:20] info  emitting declaration files...', ANSI_DIM),
    paint('[12:42:21] info  emitted 4 files to out/', ANSI_GREEN),
    '[12:42:21] info  asset extension.js 42.1 KiB [emitted] [minimized]',
    '[12:42:21] info  asset extension.js.map 118 KiB [emitted] [dev]',
    paint('[12:42:22] warn  bundle size limit exceeded: extension.js 42.1 KiB > 40 KiB', ANSI_YELLOW),
    paint('[12:42:22] info  watching for file changes...', ANSI_GREEN)
  ],
  done: (progress) => `[12:42:59] done  compiled successfully${progress}`,
  debugContent: [
    paint('./src/presentation/reader/index.ts 6.21 KiB [built] [code generated]', ANSI_GREEN),
    paint('./src/presentation/reader/CamouflageRenderer.ts 12.4 KiB [built] [code generated]', ANSI_GREEN),
    paint('WARNING in asset size limit: extension.js (42.1 KiB) exceeds recommended size', ANSI_YELLOW),
    paint('ERROR in ./src/config/settings.ts:119:7 TS2322: Type string is not assignable', ANSI_RED),
    paint('webpack 5.91.0 compiled with 1 warning in 418 ms', ANSI_YELLOW),
    paint('asset extension.js 142 KiB [emitted] [minimized]', ANSI_GREEN),
    paint('cached modules 76.4 KiB (javascript) 3.12 KiB (runtime)', ANSI_DIM),
    paint('ts-loader: project references rebuilt in 289 ms', ANSI_CYAN)
  ]
};
