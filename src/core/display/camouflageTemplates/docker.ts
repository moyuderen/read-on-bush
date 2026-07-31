import { ANSI_BLUE, ANSI_CYAN, ANSI_GREEN, ANSI_RED, ANSI_YELLOW, ANSI_DIM, paint } from './ansi';
import type { TerminalTemplate } from './types';

export const dockerTemplate: TerminalTemplate = {
  // docker compose up：正文行伪装成容器日志（容器名 | 前缀，正文天然贴合）。
  terminalName: 'docker compose',
  contentPrefix: 'app-api-1  | ',
  header: [
    paint('> docker compose up --build', ANSI_BLUE),
    '',
    paint('[+] Building 7.4s (14/14) FINISHED', ANSI_GREEN),
    ' => [app-api internal] load build definition from Dockerfile 0.0s',
    ' => [app-api 5/6] RUN npm ci --omit=dev 3.8s',
    paint('[+] Running 4/4', ANSI_GREEN),
    paint(' ✔ Network app_default    Created    0.1s', ANSI_GREEN),
    paint(' ✔ Container app-db-1      Started    0.4s', ANSI_GREEN),
    paint(' ✔ Container app-cache-1   Started    0.5s', ANSI_GREEN),
    paint(' ✔ Container app-api-1     Started    0.8s', ANSI_GREEN),
    'Attaching to app-db-1, app-cache-1, app-api-1, app-worker-1',
    ''
  ],
  trailing: [
    '',
    'app-db-1    | 2024-07-27 09:42:13  ready for connections',
    'app-cache-1 | 1:M 27 Jul 2024 09:42:13.420 * Ready to accept connections',
    'app-api-1   | INFO  worker booted in 0.9s, concurrency=4',
    paint('app-worker-1| WARN  queue lag above threshold lag=128ms', ANSI_YELLOW),
    paint('app-api-1   | ERROR failed to publish metrics: dial tcp 10.5.0.8:4317: connect: refused', ANSI_RED),
    paint('app-api-1   | INFO  retrying metrics export in 5s', ANSI_GREEN)
  ],
  done: (progress) => `app-api-1 exited with code 0${progress}`,
  debugContent: [
    paint('app-api-1  | INFO  GET /api/orders 200 14ms request_id=req_710a', ANSI_GREEN),
    paint('app-db-1   | LOG:  duration: 42.118 ms  statement: SELECT * FROM books WHERE id=$1', ANSI_DIM),
    paint('app-api-1  | ERROR UnhandledPromiseRejection: cover cache timeout after 1500ms', ANSI_RED),
    paint('app-cache-1| 1:M 27 Jul 09:42:18.192 * 100 changes in 300 seconds. Saving...', ANSI_CYAN),
    paint('app-api-1  | INFO  POST /api/checkout 201 38ms user_id=usr_42', ANSI_GREEN),
    paint('app-cache-1| INFO  SET order:42 expired in 300s', ANSI_GREEN),
    paint('app-api-1  | INFO  GET /api/products 200 9ms cache=hit', ANSI_GREEN),
    paint('app-worker-1| INFO  completed job=sync-books duration=221ms', ANSI_GREEN)
  ]
};
