/**
 * Parse and sanitize structured cacheTrace events from the bundle's stderr.
 * Only recognized stages, request identities and finite counters become evidence;
 * unrelated log output is ignored and malformed trace records fail qualification.
 *
 * Imported by run.ts; this module is not a command.
 */

import type { TraceStage, TraceEvent, TraceCounters } from '../../src/trace.js';

const stages = new Set([
  'request.start',
  'request',
  'request.queue',
  'local.hash-lock',
  'local.lookup',
  'local.metadata',
  'local.verify',
  'local.touch',
  'local.receive',
  'local.write',
  'local.fsync',
  'local.metadata-write',
  'local.metadata-fsync',
  'local.directory-fsync',
  'local.commit',
  'disk.queue',
  'disk.scan',
  'disk.evict',
  'disk.statfs',
  'artifact.resolve',
  'artifact.headers',
  'artifact.body',
  'response.stream',
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stage(value: unknown): value is TraceStage {
  return typeof value === 'string' && stages.has(value);
}

export function parseTraceEvents(line: string): TraceEvent[] {
  const marker = line.indexOf('{"cacheTrace":');
  if (marker < 0) {
    return [];
  }

  const document: unknown = JSON.parse(line.slice(marker));
  const event = object(document) ? document.cacheTrace : undefined;
  if (
    !object(event) ||
    !stage(event.stage) ||
    typeof event.requestId !== 'string' ||
    !/^[0-9]+-[0-9]+$/.test(event.requestId) ||
    typeof event.hash !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(event.hash) ||
    typeof event.pid !== 'number' ||
    !Number.isSafeInteger(event.pid) ||
    event.pid < 1 ||
    typeof event.startMs !== 'number' ||
    !Number.isFinite(event.startMs) ||
    event.startMs < 0 ||
    typeof event.durationMs !== 'number' ||
    !Number.isFinite(event.durationMs) ||
    event.durationMs < 0
  ) {
    throw new Error('Invalid trace event');
  }

  const counters: TraceCounters = {};
  const keys: (keyof TraceCounters)[] = ['bytes', 'entries', 'chunks', 'reservedBytes'];
  for (const key of keys) {
    const value = object(event.counters) ? event.counters[key] : undefined;
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error('Invalid trace counter');
    }

    counters[key] = value;
  }

  return [
    {
      requestId: event.requestId,
      hash: event.hash,
      stage: event.stage,
      pid: event.pid,
      startMs: event.startMs,
      durationMs: event.durationMs,
      ...(Object.keys(counters).length ? { counters } : {}),
    },
  ];
}
