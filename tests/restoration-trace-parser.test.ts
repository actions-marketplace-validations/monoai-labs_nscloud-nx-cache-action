import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTraceEvents } from '../bench/restoration/trace-parser.js';
import { processDelta } from '../bench/restoration/process-stats.js';
import { analyzeResults } from '../bench/restoration/analyze.js';

test('trace parser keeps only monotonic spans and numeric counters', () => {
  const event = {
    requestId: '12-1',
    hash: 'synthetic',
    stage: 'disk.scan',
    pid: 12,
    startMs: 1,
    durationMs: 2,
    token: 'private-token',
    signedUrl: 'private-url',
    counters: { bytes: 7, token: 'private-token' },
  };

  const parsed = parseTraceEvents(JSON.stringify({ cacheTrace: event }));
  const parsedEvent = parsed[0];
  assert.ok(parsedEvent);
  assert.equal(parsedEvent.counters?.bytes, 7);
  assert(!JSON.stringify(parsed).includes('private-'));

  assert.deepEqual(parseTraceEvents('private noise'), []);

  for (const change of [
    { pid: -1 },
    { startMs: NaN },
    { durationMs: -1 },
    { hash: 'https://private' },
    { stage: 'private-url' },
    { counters: { bytes: -1 } },
  ]) {
    assert.throws(() => parseTraceEvents(JSON.stringify({ cacheTrace: { ...event, ...change } })));
  }
});

test('adapter process deltas distinguish tick resolution and cumulative memory from batch IO', () => {
  assert.deepEqual(processDelta(null, null), { available: false });

  const before = {
    userMs: 10,
    systemMs: 20,
    rssBytes: 100,
    lifetimePeakRssBytes: 200,
    cpuResolutionMs: 10,
    readBytes: 3,
    writeBytes: 5,
  };
  const after = { ...before, userMs: 30, systemMs: 30, readBytes: 13, writeBytes: 45 };

  const delta = processDelta(before, after);
  assert.equal(delta.cpuUserMs, 20);
  assert.equal(delta.cpuSystemMs, 10);
  assert.equal(delta.readBytes, 10);
  assert.equal(delta.writeBytes, 40);
  assert.equal(delta.lifetimePeakRssBytes, 200);
  assert.equal(delta.cpuResolutionMs, 10);
});

test('traced runs cannot produce an uninstrumented performance verdict', () => {
  const bundle = { revision: 'a'.repeat(40), digest: 'b'.repeat(64) };
  const result = {
    schemaVersion: 1,
    jobId: 'test',
    protocol: 'restoration-perf-v1',
    runtime: {
      node: '24.21.0',
      nx: '23.2.1',
      platform: 'linux',
      arch: 'x64',
      runnerProfile: 'test',
      region: 'ord',
    },
    baseline: bundle,
    candidate: bundle,
    corpusDigest: 'c'.repeat(64),
    samples: [],
    failures: [],
    preparation: { trace: { candidateEnabled: true } },
  };
  assert(analyzeResults([result]).issues.includes('traced-performance-comparison'));

  const overhead = analyzeResults([result], { kind: 'tracing-overhead' });
  assert.equal(overhead.status, 'incomplete');
  assert.equal(overhead.method.kind, 'tracing-overhead');
  assert(
    analyzeResults([{ ...result, candidate: { ...bundle, digest: 'd'.repeat(64) } }], {
      kind: 'tracing-overhead',
    }).issues.includes('invalid-tracing-overhead-control'),
  );
});
