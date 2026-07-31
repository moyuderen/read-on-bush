import { ANSI_BLUE, ANSI_CYAN, ANSI_DIM, ANSI_GREEN, ANSI_RED, ANSI_YELLOW, paint } from './ansi';
import type { TerminalTemplate } from './types';

export const viteTemplate: TerminalTemplate = {
  // Vite 开发服务器：正文行伪装成 HMR/文件事件。
  terminalName: 'vite',
  contentPrefix: '9:42:13 AM [vite] ',
  header: [
    paint('> vite --host 0.0.0.0', ANSI_BLUE),
    '',
    paint('  VITE v5.4.10  ready in 312 ms', ANSI_GREEN),
    paint('  ➜  Local:   http://localhost:5173/', ANSI_CYAN),
    paint('  ➜  Network: http://192.168.1.12:5173/', ANSI_CYAN),
    paint('  ➜  press h + enter to show help', ANSI_DIM),
    '',
    paint('9:42:17 AM [vite] Pre-transform error: Failed to resolve import "@/api/orders"', ANSI_RED),
    paint('9:42:18 AM [vite] Internal server error: Cannot read properties of undefined (reading "map")', ANSI_RED),
    paint('  Plugin: vite:react-babel', ANSI_DIM),
    paint('  File: /src/features/orders/OrderList.tsx:88:21', ANSI_CYAN),
    ''
  ],
  trailing: [
    '',
    paint('9:42:48 AM [vite] hmr update /src/App.tsx, /src/index.css', ANSI_GREEN),
    paint('9:42:51 AM [vite] page reload src/routes/dashboard.tsx', ANSI_CYAN),
    paint('9:42:55 AM [vite] hmr update /src/components/Orders.tsx', ANSI_GREEN),
    paint('9:42:58 AM [vite] ✨ new dependencies optimized: lodash-es, dayjs', ANSI_GREEN),
    paint('9:43:00 AM [vite] hmr invalidate /src/hooks/useOrders.ts Could not Fast Refresh', ANSI_YELLOW)
  ],
  done: (progress) => `9:43:02 AM [vite] optimized${progress}`,
  debugContent: [
    paint('9:42:14 AM [vite] hmr update /src/components/Header.tsx', ANSI_GREEN),
    paint('9:42:15 AM [vite] Pre-transform error: Unexpected token (42:17)', ANSI_RED),
    paint('9:42:16 AM [vite] page reload src/App.tsx', ANSI_CYAN),
    paint('9:42:17 AM [vite] hmr update /src/api/client.ts', ANSI_GREEN),
    paint('9:42:18 AM [vite] new dependencies optimized: axios, zustand', ANSI_GREEN),
    paint('9:42:19 AM [vite] hmr update /src/utils/format.ts', ANSI_GREEN),
    paint('9:42:20 AM [vite] warning: export default was not found in ./ChartCard', ANSI_YELLOW),
    paint('9:42:21 AM [vite] client connected: ws://localhost:5173', ANSI_CYAN)
  ]
};
