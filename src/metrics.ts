import { CacheIntegrityError } from './local-store.js';
import { Code } from '@connectrpc/connect';

export const CacheOperation = Object.freeze({
  Get: 'get',
  Put: 'put',
  Publish: 'publish',
  Remote: 'remote',
});
export const CacheTier = Object.freeze({
  Local: 'local',
  Artifact: 'artifact',
  Miss: 'miss',
  Error: 'error',
  ReadOnly: 'readonly',
  Policy: 'policy',
  AlreadyPresent: 'already-present',
  Unavailable: 'unavailable',
  Corrupt: 'corrupt',
  Overload: 'overload',
});

export interface CacheEvent {
  operation: (typeof CacheOperation)[keyof typeof CacheOperation];
  tier: (typeof CacheTier)[keyof typeof CacheTier];
  hash: string;
  durationMs: number;
  bytes?: number;
  errorCode?: string;
}

export function errorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown';
  }
  if (error instanceof CacheIntegrityError) {
    return 'integrity';
  }

  // Node.js system error names: https://nodejs.org/api/os.html#error-constants
  if (
    'code' in error &&
    typeof error.code === 'string' &&
    /^(ENOENT|ENOSPC|EACCES|EPERM|ETIMEDOUT|ECONNRESET)$/.test(error.code)
  ) {
    return error.code;
  }

  if (
    'code' in error &&
    typeof error.code === 'number' &&
    Number.isInteger(error.code) &&
    error.code >= 0 &&
    error.code <= Code.Unauthenticated
  ) {
    return `rpc-${error.code}`;
  }

  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return 'timeout';
  }

  return 'cache-operation';
}

export type RecordEvent = (event: CacheEvent) => void;

export const writeEvent: RecordEvent = (event) =>
  process.stderr.write(`${JSON.stringify({ cache: event })}\n`);

export interface CacheOperationTotal {
  count: number;
  bytes: number;
  durationMs: number;
}

export type CacheMetricsSnapshot = ReturnType<CacheMetrics['snapshot']>;

type MetricsByTier = Partial<Record<CacheEvent['tier'], keyof CacheMetricsSnapshot>>;

const OPERATION_METRICS: Partial<Record<CacheEvent['operation'], MetricsByTier>> = {
  [CacheOperation.Get]: {
    [CacheTier.Local]: 'localHits',
    [CacheTier.Artifact]: 'artifactHits',
    [CacheTier.Miss]: 'misses',
  },
  [CacheOperation.Put]: { [CacheTier.Local]: 'localWrites' },
  [CacheOperation.Publish]: { [CacheTier.Artifact]: 'publications' },
};

const TIER_METRICS: MetricsByTier = {
  [CacheTier.ReadOnly]: 'readOnlySkips',
  [CacheTier.Policy]: 'policySkips',
  [CacheTier.AlreadyPresent]: 'alreadyPresent',
  [CacheTier.Unavailable]: 'unavailable',
  [CacheTier.Corrupt]: 'corrupt',
  [CacheTier.Overload]: 'overload',
  [CacheTier.Error]: 'errors',
};

function emptyTotal(): CacheOperationTotal {
  return { count: 0, bytes: 0, durationMs: 0 };
}

function add(total: CacheOperationTotal, event: CacheEvent): void {
  total.count += 1;
  total.bytes += event.bytes ?? 0;
  total.durationMs += event.durationMs;
}

export class CacheMetrics {
  readonly #totals = {
    localHits: emptyTotal(),
    artifactHits: emptyTotal(),
    misses: emptyTotal(),
    localWrites: emptyTotal(),
    publications: emptyTotal(),
    readOnlySkips: emptyTotal(),
    policySkips: emptyTotal(),
    alreadyPresent: emptyTotal(),
    unavailable: emptyTotal(),
    corrupt: emptyTotal(),
    overload: emptyTotal(),
    errors: emptyTotal(),
  };

  constructor(private readonly emit: RecordEvent = writeEvent) {}

  readonly record: RecordEvent = (event) => {
    this.emit(event);

    const metricName = OPERATION_METRICS[event.operation]?.[event.tier] ?? TIER_METRICS[event.tier];
    if (metricName) {
      add(this.#totals[metricName], event);
    }
  };

  snapshot() {
    return structuredClone(this.#totals);
  }
}
