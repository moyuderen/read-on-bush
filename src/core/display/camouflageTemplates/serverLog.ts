import { ANSI_BLUE, ANSI_DIM, ANSI_GREEN, ANSI_RED, ANSI_YELLOW, paint } from './ansi';
import type { TerminalTemplate } from './types';

export const serverLogTemplate: TerminalTemplate = {
  terminalName: 'dev server',
  contentPrefix: 'INFO  ',
  header: [
    paint('npm run dev', ANSI_BLUE),
    '',
    paint('INFO  Server listening on http://localhost:3000', ANSI_GREEN),
    paint('INFO  Loaded env from .env.local', ANSI_GREEN),
    paint('INFO  Connected to local workspace cache', ANSI_GREEN),
    paint('INFO  Prisma client initialized pool=8', ANSI_GREEN),
    paint('INFO  GET /api/workspaces 200 14ms trace=trc_71b2', ANSI_GREEN),
    paint('INFO  GET /api/projects/current 200 18ms cache=hit', ANSI_GREEN),
    paint('WARN  feature flag orders.bulkEdit missing, falling back to default=false', ANSI_YELLOW),
    paint('DEBUG requestId=req_42f8 route=/api/runtime/status auth=user_1001', ANSI_DIM),
    ''
  ],
  trailing: [
    '',
    paint('DEBUG requestId=req_42f8 normalized payload in 3ms size=1.8kb', ANSI_DIM),
    paint('INFO  POST /api/runtime/events 202 9ms queue=local', ANSI_GREEN),
    paint('ERROR requestId=req_b19a upstream retryable error: ECONNRESET attempt=1/3', ANSI_RED),
    paint('INFO  retry requestId=req_b19a succeeded in 87ms', ANSI_GREEN),
    paint('INFO  background worker heartbeat ok lag=2ms jobs=0', ANSI_GREEN)
  ],
  done: (progress) => `INFO  request completed${progress}`,
  debugContent: [
    paint('DEBUG requestId=req_91af route=/api/runtime/events payload normalized in 4ms', ANSI_DIM),
    paint('WARN  requestId=req_91af slow query threshold exceeded duration=42ms model=Book', ANSI_YELLOW),
    paint('ERROR requestId=req_91af upstream timeout after 1500ms service=cover-cache', ANSI_RED),
    paint('INFO  GET /api/workspaces/current 200 16ms cache=hit', ANSI_GREEN),
    paint('INFO  POST /api/telemetry/batch 202 11ms queue=local', ANSI_GREEN),
    paint('DEBUG worker=bookshelf-sync heartbeat ok drift=2ms', ANSI_DIM),
    paint('INFO  cache refresh completed keys=24 stale=0', ANSI_GREEN),
    paint('DEBUG requestId=req_a10c route=/api/features flags resolved in 2ms', ANSI_DIM)
  ]
};
