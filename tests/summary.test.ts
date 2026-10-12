import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CacheMetrics,
  errorCode,
  type CacheEvent,
  CacheOperation,
  CacheTier,
} from '../src/metrics.js';
import { CacheIntegrityError } from '../src/local-store.js';
import { appendCacheSummary, renderCacheSummary } from '../src/summary.js';

const events: CacheEvent[] = [
  {
    operation: CacheOperation.Get,
    tier: CacheTier.Local,
    hash: 'private-local-hash',
    bytes: 10,
    durationMs: 1.2,
  },
  {
    operation: CacheOperation.Get,
    tier: CacheTier.Artifact,
    hash: 'private-artifact-hash',
    bytes: 20,
    durationMs: 2.4,
  },
  {
    operation: CacheOperation.Get,
    tier: CacheTier.Miss,
    hash: 'private-miss-hash',
    durationMs: 3.6,
  },
  {
    operation: CacheOperation.Put,
    tier: CacheTier.Local,
    hash: 'private-write-hash',
    bytes: 30,
    durationMs: 4.8,
  },
  {
    operation: CacheOperation.Publish,
    tier: CacheTier.Artifact,
    hash: 'private-publish-hash',
    bytes: 40,
    durationMs: 5.1,
  },
  {
    operation: CacheOperation.Put,
    tier: CacheTier.ReadOnly,
    hash: 'private-readonly-hash',
    durationMs: 6.2,
  },
  {
    operation: CacheOperation.Get,
    tier: CacheTier.Error,
    hash: 'private-error-hash',
    durationMs: 7.3,
    errorCode: 'timeout',
  },
];

test('summary aggregates bounded operation totals without identifiers or error details', () => {
  const emitted: CacheEvent[] = [];
  const metrics = new CacheMetrics((event) => emitted.push(event));
  for (const event of events) {
    metrics.record(event);
  }

  assert.deepEqual(emitted, events);
  assert.deepEqual(metrics.snapshot(), {
    localHits: { count: 1, bytes: 10, durationMs: 1.2 },
    artifactHits: { count: 1, bytes: 20, durationMs: 2.4 },
    misses: { count: 1, bytes: 0, durationMs: 3.6 },
    localWrites: { count: 1, bytes: 30, durationMs: 4.8 },
    publications: { count: 1, bytes: 40, durationMs: 5.1 },
    readOnlySkips: { count: 1, bytes: 0, durationMs: 6.2 },
    policySkips: { count: 0, bytes: 0, durationMs: 0 },
    alreadyPresent: { count: 0, bytes: 0, durationMs: 0 },
    unavailable: { count: 0, bytes: 0, durationMs: 0 },
    corrupt: { count: 0, bytes: 0, durationMs: 0 },
    overload: { count: 0, bytes: 0, durationMs: 0 },
    errors: { count: 1, bytes: 0, durationMs: 7.3 },
  });

  const summary = renderCacheSummary(metrics.snapshot());
  for (const label of [
    'Local hits',
    'Artifact hits',
    'Misses',
    'Local writes',
    'Artifact publications',
    'Read-only skips',
    'Errors',
  ]) {
    assert.match(summary, new RegExp(`\\| ${label} \\| 1 \\|`));
  }

  assert.match(summary, /not Nx task count or wall time/);
  assert.doesNotMatch(summary, /private-|timeout|https?:\/\//);
});

test('summary appends a separate table for each invocation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-summary-'));
  const path = join(directory, 'summary.md');
  const metrics = new CacheMetrics(() => {});
  metrics.record({
    operation: CacheOperation.Get,
    tier: CacheTier.Local,
    hash: 'private-local-hash',
    bytes: 10,
    durationMs: 1.2,
  });

  try {
    assert.equal(await appendCacheSummary(path, metrics.snapshot()), true);
    assert.equal(await appendCacheSummary(path, metrics.snapshot()), true);

    const contents = await readFile(path, 'utf8');
    assert.equal(contents.match(/### Nx cache operations/g)?.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('summary publication failure is reported without throwing', async () => {
  let reports = 0;
  const result = await appendCacheSummary(
    '/unwritable/summary.md',
    new CacheMetrics(() => {}).snapshot(),
    async () => {
      throw new Error('path contains a secret');
    },
    () => {
      reports += 1;
    },
  );
  assert.equal(result, false);
  assert.equal(reports, 1);
});

test('integrity errors are classified by type', () => {
  assert.equal(errorCode(new CacheIntegrityError('invalid archive')), 'integrity');
});
