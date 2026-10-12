import { AsyncLocalStorage } from 'node:async_hooks';

export type TraceStage =
  | 'request.start'
  | 'request'
  | 'request.queue'
  | 'local.hash-lock'
  | 'local.lookup'
  | 'local.metadata'
  | 'local.verify'
  | 'local.touch'
  | 'local.receive'
  | 'local.write'
  | 'local.fsync'
  | 'local.metadata-write'
  | 'local.metadata-fsync'
  | 'local.directory-fsync'
  | 'local.commit'
  | 'disk.queue'
  | 'disk.scan'
  | 'disk.evict'
  | 'disk.statfs'
  | 'artifact.resolve'
  | 'artifact.headers'
  | 'artifact.body'
  | 'response.stream';

export interface TraceCounters {
  bytes?: number;
  entries?: number;
  chunks?: number;
  reservedBytes?: number;
}

export interface TraceEvent {
  requestId: string;
  hash: string;
  stage: TraceStage;
  pid: number;
  startMs: number;
  durationMs: number;
  counters?: TraceCounters;
}

interface Context {
  requestId: string;
  hash: string;
}

/** Optional request-scoped monotonic intervals. Inclusive stages can overlap. */
export class CacheTrace {
  private readonly context = new AsyncLocalStorage<Context>();
  private sequence = 0;

  constructor(private readonly record: (event: TraceEvent) => void) {}

  async request<T>(hash: string, work: () => Promise<T>): Promise<T> {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(hash)) {
      throw new Error('Invalid trace identity');
    }

    const context = { requestId: `${process.pid}-${++this.sequence}`, hash };
    return this.context.run(context, async () => {
      this.record({
        ...context,
        stage: 'request.start',
        pid: process.pid,
        startMs: performance.now(),
        durationMs: 0,
      });

      const finish = this.begin('request');
      try {
        return await work();
      } finally {
        finish?.();
      }
    });
  }

  begin(stage: TraceStage): ((counters?: TraceCounters) => void) | undefined {
    const context = this.context.getStore();
    if (!context) {
      return undefined;
    }

    const startMs = performance.now();
    let completed = false;
    return (counters) => {
      if (completed) {
        return;
      }

      completed = true;

      const safe: TraceCounters = {};
      for (const key of [
        'bytes',
        'entries',
        'chunks',
        'reservedBytes',
      ] satisfies (keyof TraceCounters)[]) {
        const value = counters?.[key];
        if (value !== undefined && Number.isSafeInteger(value) && value >= 0) {
          safe[key] = value;
        }
      }

      this.record({
        ...context,
        stage,
        pid: process.pid,
        startMs,
        durationMs: performance.now() - startMs,
        ...(Object.keys(safe).length ? { counters: safe } : {}),
      });
    };
  }
}

export function writeTrace(event: TraceEvent): void {
  process.stderr.write(`${JSON.stringify({ cacheTrace: event })}\n`);
}
