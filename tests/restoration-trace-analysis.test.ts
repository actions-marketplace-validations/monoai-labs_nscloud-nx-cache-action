import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { summarizeTrace, unionDuration } from '../bench/restoration/trace-analysis.js';

// Malformed values and private fields are intentional inputs to runtime validation.
interface FixtureEvent {
  requestId: string;
  hash: string;
  pid: number;
  stage: string;
  startMs: number;
  durationMs: number;
  url?: string;
  message?: string;
  counters?: Record<string, number | string>;
}

interface FixtureSample {
  jobId: string;
  arm: string;
  profileId: string;
  concurrency: number;
  lane: string;
  population: number;
  valid: boolean;
  traceRequestIds?: string[] | string | undefined;
  excluded?: string;
}

type FixtureBundle = { revision: string; digest: string };

type FixtureArm = FixtureBundle & { traced: boolean; events: FixtureEvent[] };

interface FixtureTrace {
  schemaVersion: number;
  jobId: string;
  runtime: Record<string, string>;
  arms: { baseline: FixtureArm; candidate: FixtureArm };
  raw?: string;
}

interface FixtureResult {
  jobId: string;
  baseline: FixtureBundle;
  candidate: FixtureBundle;
  samples: FixtureSample[];
  message?: string;
}

type Fixture = { trace: FixtureTrace; result: FixtureResult };

function required<T>(value: T | undefined): T {
  assert.ok(value !== undefined);

  return value;
}

const digest = 'a'.repeat(64);

function fixture(): Fixture {
  return {
    trace: {
      schemaVersion: 1,
      jobId: 'job-1',
      runtime: { node: '24.21.0' },
      arms: {
        baseline: { revision: 'base', digest, traced: false, events: [] },
        candidate: { revision: 'head', digest, traced: true, events: [] },
      },
    },
    result: {
      jobId: 'job-1',
      baseline: { revision: 'base', digest },
      candidate: { revision: 'head', digest },
      samples: [],
    },
  };
}

function add(
  document: Fixture,
  id: string,
  spans: [string, number, number][],
  overrides: Partial<FixtureSample> = {},
) {
  document.result.samples.push({
    jobId: 'job-1',
    arm: 'candidate',
    profileId: 'synthetic-one',
    concurrency: 1,
    lane: 'adapter-remote',
    population: 16_384,
    valid: true,
    traceRequestIds: [id],
    ...overrides,
  });
  document.trace.arms.candidate.events.push(
    ...spans.map(([stage, startMs, durationMs]) => ({
      requestId: id,
      hash: `hash-${id}`,
      pid: 123,
      stage,
      startMs,
      durationMs,
    })),
  );
}

test('interval union preserves overlap, gaps, zero durations and unordered inputs', () => {
  assert.equal(
    unionDuration([
      { startMs: 20, durationMs: 5 },
      { startMs: 0, durationMs: 10 },
      { startMs: 5, durationMs: 10 },
      { startMs: 25, durationMs: 0 },
    ]),
    20,
  );
  assert.equal(unionDuration([]), 0);
  assert.throws(
    () => unionDuration([{ startMs: 0, durationMs: Infinity }]),
    /invalid-trace-interval/,
  );
});

test('nested receive/body/write intervals are retained without adding their inclusive totals to wall time', () => {
  const document = fixture();
  add(document, 'r1', [
    ['request', 0, 30],
    ['local.receive', 2, 20],
    ['artifact.body', 3, 15],
    ['local.write', 4, 4],
    ['local.write', 10, 3],
    ['response.stream', 22, 8],
  ]);

  const report = summarizeTrace(document.trace, document.result);
  assert.equal(required(report.requests[0]).coveredIntervalUnionMs, 28);
  assert.equal(required(report.requests[0]).intervals.length, 6);

  const write = required(
    required(report.primary[0]).stages.find((stage) => stage.stage === 'local.write'),
  );
  assert.equal(write.inclusiveDurationMs.median, 7);
  assert.equal(write.eventCount.median, 2);
  assert.equal(write.aggregation, 'serialized-write-duration');

  assert.equal(report.interpretation.performanceDecision, 'unavailable');
  assert.match(report.interpretation.body, /consumer backpressure/);
});

test('first access and warmup retain distinct summaries without changing measured quantiles', () => {
  const document = fixture();
  add(document, 'r1', [['disk.scan', 0, 10]]);
  add(document, 'r2', [['disk.scan', 20, 30]]);
  add(document, 'first', [['disk.scan', 0, 1000]], { excluded: 'first-access' });
  add(document, 'warm', [['disk.scan', 0, 2000]], { excluded: 'warmup' });

  const report = summarizeTrace(document.trace, document.result);
  assert.equal(required(required(report.primary[0]).stages[0]).inclusiveDurationMs.median, 20);
  assert.equal(required(required(report.primary[0]).stages[0]).inclusiveDurationMs.p95, 29);

  assert.deepEqual(report.excluded.map((group) => group.exclusion).sort(), [
    'first-access',
    'warmup',
  ]);

  assert.equal(report.counts.firstAccessSamples, 1);
  assert.equal(report.counts.warmupSamples, 1);
  assert.equal(report.counts.measuredSamples, 2);
});

test('correlation keeps concurrency, lane, population and arm separate; absent stages are not zeroes', () => {
  const document = fixture();
  add(document, 'a', [['local.verify', 0, 10]]);
  add(document, 'b', [['response.stream', 20, 1]]);
  add(document, 'c', [['local.verify', 0, 90]], {
    population: 0,
    lane: 'adapter-local',
    profileId: 'synthetic-two',
  });

  const sample = required(document.result.samples[2]);
  assert.ok(Array.isArray(sample.traceRequestIds));

  sample.concurrency = 2;
  sample.traceRequestIds.push('d');
  document.trace.arms.candidate.events.push({
    requestId: 'd',
    hash: 'hash-d',
    pid: 123,
    stage: 'local.verify',
    startMs: 0,
    durationMs: 110,
  });
  document.result.samples.push({
    ...required(document.result.samples[0]),
    arm: 'baseline',
    traceRequestIds: undefined,
  });

  const report = summarizeTrace(document.trace, document.result);
  assert.equal(report.primary.length, 2);
  assert.equal(required(report.primary[0]).requestCount, 2);
  assert.equal(
    required(required(report.primary[0]).stages.find((stage) => stage.stage === 'local.verify'))
      .observedRequests,
    1,
  );

  assert.equal(required(required(report.primary[1]).stages[0]).inclusiveDurationMs.median, 100);

  assert.equal(report.counts.untracedSamples, 1);
});

test('unassigned requests remain visible without invented profile correlation', () => {
  const document = fixture();
  document.trace.arms.candidate.events.push({
    requestId: 'orphan',
    hash: 'hash-orphan',
    pid: 123,
    stage: 'request.start',
    startMs: 0,
    durationMs: 0,
  });

  const report = summarizeTrace(document.trace, document.result);
  assert.equal(report.counts.uncorrelatedRequests, 1);
  assert.equal(report.primary.length, 0);
  assert.equal(required(report.requests[0]).correlation, undefined);
});

test('missing, duplicate, cross-process and invalid sample correlation fail explicitly', () => {
  const mutations: ((document: Fixture) => void)[] = [
    (document) => {
      required(document.result.samples[0]).traceRequestIds = ['missing'];
    },
    (document) => {
      document.result.samples.push({ ...required(document.result.samples[0]) });
    },
    (document) => {
      document.trace.arms.candidate.events.push({
        ...required(document.trace.arms.candidate.events[0]),
        pid: 456,
      });
    },
    (document) => {
      required(document.result.samples[0]).valid = false;
      required(document.result.samples[0]).excluded = 'warmup';
    },
    (document) => {
      required(document.result.samples[0]).traceRequestIds = 'r1';
    },
    (document) => {
      document.result.candidate.digest = 'b'.repeat(64);
    },
  ];

  for (const mutate of mutations) {
    const document = fixture();
    add(document, 'r1', [['request', 0, 1]]);
    mutate(document);
    assert.throws(() => summarizeTrace(document.trace, document.result), /trace-/);
  }
});

test('serialized-write aggregate rejects overlapping write events', () => {
  const document = fixture();
  add(document, 'r1', [
    ['local.write', 0, 5],
    ['local.write', 2, 5],
  ]);
  assert.throws(() => summarizeTrace(document.trace, document.result), /overlapping-local-writes/);
});

test('privacy whitelist drops raw fields and rejects URL stages and nonfinite timings', () => {
  const document = fixture();
  add(document, 'r1', [['request', 0, 1]]);
  document.trace.raw = 'secret';
  document.trace.runtime.token = 'secret';
  document.result.message = 'secret';

  const event = required(document.trace.arms.candidate.events[0]);
  event.url = 'https://signed.example/?token=secret';
  event.message = 'secret';
  event.counters = { bytes: 32, token: 'secret' };

  const report = summarizeTrace(document.trace, document.result);
  assert.doesNotMatch(JSON.stringify(report), /secret|signed\.example|hash-r1/);
  assert.deepEqual(required(required(report.requests[0]).intervals[0]).counters, { bytes: 32 });

  event.stage = 'https://signed.example/secret';
  assert.throws(
    () => summarizeTrace(document.trace, document.result),
    /^Error: invalid-trace-event$/,
  );

  event.stage = 'request';
  event.durationMs = NaN;
  assert.throws(() => summarizeTrace(document.trace, document.result), /invalid-trace-event/);
});

test('CLI writes sanitized report and suppresses raw JSON parser and filesystem errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'restoration-trace-analysis-'));

  try {
    const document = fixture();
    add(document, 'r1', [['request', 0, 1]]);

    const traceFile = join(directory, 'trace.json'),
      resultFile = join(directory, 'result.json'),
      output = join(directory, 'report.json');
    await writeFile(traceFile, JSON.stringify(document.trace));
    await writeFile(resultFile, JSON.stringify(document.result));

    const command = new URL('../bench/restoration/trace-analysis.ts', import.meta.url);
    const success = spawnSync(
      process.execPath,
      ['--import', 'tsx', command.pathname, traceFile, resultFile, output],
      {
        encoding: 'utf8',
      },
    );
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).counts.correlatedRequests, 1);

    await writeFile(traceFile, '{"token":"supersecret" invalid');

    const failed = spawnSync(
      process.execPath,
      ['--import', 'tsx', command.pathname, traceFile, resultFile],
      {
        encoding: 'utf8',
      },
    );
    assert.equal(failed.status, 1);
    assert.equal(failed.stdout, '');
    assert.equal(failed.stderr, 'trace-analysis-failed\n');

    const missing = spawnSync(
      process.execPath,
      ['--import', 'tsx', command.pathname, join(directory, 'secret-path'), resultFile],
      { encoding: 'utf8' },
    );
    assert.equal(missing.stderr, 'trace-analysis-failed\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
