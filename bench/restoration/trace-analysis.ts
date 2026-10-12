/**
 * Correlate adapter trace spans with restoration samples and summarize stage costs.
 * Inclusive body, receive and write spans overlap, so interval unions and separate
 * stage summaries prevent double-counting elapsed time. Correlation and sanitation
 * checks keep unrelated requests or raw provider data out of measurement evidence.
 *
 * Run: pnpm exec tsx bench/restoration/trace-analysis.ts <trace.json> <block.json> [output.json].
 * Writes a JSON report to the output file or stdout, including sanitized failures.
 */

import type { TraceCounters, TraceStage } from '../../src/trace.js';
import type { Arm, TraceCorrelation, TraceInterval, TraceRequest } from './analysis-types.js';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  RestorationLane,
  SampleExclusion,
  BenchmarkArm,
  MEDIAN_QUANTILE,
  P95_QUANTILE,
} from './benchmark-policy.js';
import { NODE_USER_ARGUMENT_OFFSET, ExitCode } from '../../src/process-constants.js';

type PendingRequest = {
  requestId: string;
  arm: Arm;
  pid: number;
  hash: string;
  intervals: TraceInterval[];
  correlation?: TraceCorrelation;
};

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

const counterKeys: (keyof TraceCounters)[] = ['bytes', 'entries', 'chunks', 'reservedBytes'];
const runtimeKeys = ['node', 'nx', 'pnpm', 'sdk', 'platform', 'arch', 'runnerProfile', 'region'];

function fail(code: string): never {
  throw new Error(code);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function array(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
}

function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function stage(value: unknown): value is TraceStage {
  return typeof value === 'string' && stages.has(value);
}

/** Union of monotonic intervals, never a sum of overlapping inclusive spans. */
export function unionDuration(intervals: { startMs: number; durationMs: number }[]) {
  const sorted = intervals
    .map((interval) => {
      if (
        !number(interval.startMs) ||
        !number(interval.durationMs) ||
        !number(interval.startMs + interval.durationMs)
      ) {
        fail('invalid-trace-interval');
      }

      return { start: interval.startMs, end: interval.startMs + interval.durationMs };
    })
    .sort((left, right) => left.start - right.start);
  let total = 0;
  let start: number | undefined;
  let end: number | undefined;
  for (const { start: nextStart, end: nextEnd } of sorted) {
    if (start === undefined || end === undefined) {
      start = nextStart;
      end = nextEnd;
    } else if (nextStart <= end) {
      end = Math.max(end, nextEnd);
    } else {
      total += end - start;
      start = nextStart;
      end = nextEnd;
    }
  }

  return start === undefined || end === undefined ? 0 : total + end - start;
}

function distribution(values: number[]) {
  if (!values.length) {
    return { count: 0 };
  }

  const sorted = [...values].sort((left, right) => left - right);

  const at = (probability: number) => {
    const index = (sorted.length - 1) * probability;
    const lower = Math.floor(index);
    const left = sorted[lower];
    const right = sorted[Math.ceil(index)];
    if (left === undefined || right === undefined) {
      fail('invalid-trace-distribution');
    }

    return left + (right - left) * (index - lower);
  };

  return { count: values.length, median: at(MEDIAN_QUANTILE), p95: at(P95_QUANTILE) };
}

function event(value: unknown) {
  if (
    !object(value) ||
    !identifier(value.requestId) ||
    typeof value.hash !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(value.hash) ||
    !stage(value.stage) ||
    !positiveInteger(value.pid) ||
    !number(value.startMs) ||
    !number(value.durationMs) ||
    !number(value.startMs + value.durationMs)
  ) {
    fail('invalid-trace-event');
  }

  const counters: TraceCounters = {};
  if (value.counters !== undefined) {
    if (!object(value.counters)) {
      fail('invalid-trace-counters');
    }

    for (const key of counterKeys) {
      if (value.counters[key] !== undefined) {
        const counter = value.counters[key];
        if (typeof counter !== 'number' || !Number.isSafeInteger(counter) || counter < 0) {
          fail('invalid-trace-counters');
        }

        counters[key] = counter;
      }
    }
  }

  return {
    identity: { requestId: value.requestId, pid: value.pid, hash: value.hash },
    interval: {
      stage: value.stage,
      startMs: value.startMs,
      durationMs: value.durationMs,
      ...(Object.keys(counters).length ? { counters } : {}),
    },
  };
}

function identity(sample: Record<string, unknown>, arm: Arm, jobId: string): TraceCorrelation {
  if (
    !object(sample) ||
    sample.arm !== arm ||
    sample.jobId !== jobId ||
    !identifier(sample.profileId) ||
    !positiveInteger(sample.concurrency) ||
    (sample.lane !== RestorationLane.AdapterRemote &&
      sample.lane !== RestorationLane.AdapterLocal) ||
    typeof sample.population !== 'number' ||
    !Number.isSafeInteger(sample.population) ||
    sample.population < 0 ||
    sample.valid !== true ||
    (sample.excluded !== undefined &&
      sample.excluded !== SampleExclusion.FirstAccess &&
      sample.excluded !== SampleExclusion.Warmup)
  ) {
    fail('invalid-trace-sample');
  }

  return {
    arm,
    profileId: sample.profileId,
    concurrency: sample.concurrency,
    lane: sample.lane,
    population: sample.population,
    exclusion: sample.excluded ?? 'measured',
  };
}

/** Descriptive attribution only: diagnostic requests are not a paired performance gate. */
export function summarizeTrace(trace: unknown, result: unknown) {
  if (
    !object(trace) ||
    trace.schemaVersion !== 1 ||
    !identifier(trace.jobId) ||
    !object(trace.arms) ||
    !object(result) ||
    result.jobId !== trace.jobId ||
    !array(result.samples)
  ) {
    fail('invalid-trace-document');
  }

  const samples = result.samples.map((sample) => {
    if (
      !object(sample) ||
      (sample.arm !== BenchmarkArm.Baseline && sample.arm !== BenchmarkArm.Candidate)
    ) {
      fail('invalid-trace-sample');
    }

    return sample;
  });

  const runtime: Record<string, string> = {};
  if (object(trace.runtime)) {
    for (const key of runtimeKeys) {
      if (trace.runtime[key] !== undefined) {
        if (
          typeof trace.runtime[key] !== 'string' ||
          !/^[a-zA-Z0-9._-]{1,100}$/.test(trace.runtime[key])
        ) {
          fail('invalid-trace-runtime');
        }

        runtime[key] = trace.runtime[key];
      }
    }
  }

  const requests: TraceRequest[] = [];
  const arms: Partial<Record<Arm, { revision: string; digest: string; traced: boolean }>> = {};

  const groups: Map<string, { correlation: TraceCorrelation; requests: TraceRequest[] }> =
    new Map();
  const counts = {
    correlatedRequests: 0,
    uncorrelatedRequests: 0,
    untracedSamples: 0,
    measuredSamples: 0,
    firstAccessSamples: 0,
    warmupSamples: 0,
  };

  const armNames: Arm[] = [BenchmarkArm.Baseline, BenchmarkArm.Candidate];
  for (const arm of armNames) {
    const source = trace.arms[arm];
    if (
      !object(source) ||
      typeof source.revision !== 'string' ||
      !/^[a-zA-Z0-9._/-]{1,128}$/.test(source.revision) ||
      typeof source.digest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(source.digest) ||
      typeof source.traced !== 'boolean' ||
      !array(source.events) ||
      (!source.traced && source.events.length)
    ) {
      fail('invalid-trace-arm');
    }

    const resultArm = result[arm];
    if (
      object(resultArm) &&
      (source.revision !== resultArm.revision || source.digest !== resultArm.digest)
    ) {
      fail('trace-bundle-mismatch');
    }

    arms[arm] = { revision: source.revision, digest: source.digest, traced: source.traced };

    const byId: Map<string, PendingRequest> = new Map();
    for (const raw of source.events) {
      const clean = event(raw);
      const request: PendingRequest = byId.get(clean.identity.requestId) ?? {
        ...clean.identity,
        arm,
        intervals: [],
      };
      if (request.pid !== clean.identity.pid || request.hash !== clean.identity.hash) {
        fail('trace-request-identity-mismatch');
      }

      request.intervals.push(clean.interval);
      byId.set(clean.identity.requestId, request);
    }

    for (const sample of samples.filter((sample) => sample.arm === arm)) {
      const correlation = identity(sample, arm, trace.jobId);
      const requestIds = sample.traceRequestIds;
      if (requestIds !== undefined && !array(requestIds)) {
        fail('invalid-trace-correlation');
      }
      if (!requestIds?.length) {
        counts.untracedSamples++;
        continue;
      }
      if (
        requestIds.length !== sample.concurrency ||
        new Set(requestIds).size !== requestIds.length
      ) {
        fail('invalid-trace-correlation');
      }

      counts[
        correlation.exclusion === 'measured'
          ? 'measuredSamples'
          : correlation.exclusion === SampleExclusion.FirstAccess
            ? 'firstAccessSamples'
            : 'warmupSamples'
      ]++;
      for (const requestId of requestIds) {
        if (!identifier(requestId)) {
          fail('invalid-trace-correlation');
        }

        const request = byId.get(requestId);
        if (!request || request.correlation) {
          fail('trace-correlation-mismatch');
        }

        request.correlation = correlation;
      }
    }

    for (const pending of byId.values()) {
      // Hashes are used for identity validation, but need not be persisted again.
      const request = {
        requestId: pending.requestId,
        arm: pending.arm,
        pid: pending.pid,
        intervals: pending.intervals,
        ...(pending.correlation ? { correlation: pending.correlation } : {}),
      };

      request.intervals.sort((left, right) => left.startMs - right.startMs);
      const coveredIntervalUnionMs = unionDuration(
        request.intervals.filter(
          (span) => span.stage !== 'request' && span.stage !== 'request.start',
        ),
      );

      const stageSummaries = [...new Set(request.intervals.map((span) => span.stage))]
        .sort()
        .map((stage) => {
          const intervals = request.intervals.filter((span) => span.stage === stage);
          const inclusiveDurationMs = intervals.reduce((total, span) => total + span.durationMs, 0);
          const intervalUnionMs = unionDuration(intervals);
          if (stage === 'local.write' && Math.abs(inclusiveDurationMs - intervalUnionMs) > 1e-6) {
            fail('overlapping-local-writes');
          }

          return {
            stage,
            eventCount: intervals.length,
            inclusiveDurationMs,
            intervalUnionMs,
            ...(stage === 'local.write' ? { aggregation: 'serialized-write-duration' } : {}),
          };
        });

      const complete = { ...request, coveredIntervalUnionMs, stages: stageSummaries };
      if (request.correlation) {
        counts.correlatedRequests++;
        const key = JSON.stringify(request.correlation);
        const group = groups.get(key) ?? { correlation: request.correlation, requests: [] };
        group.requests.push(complete);
        groups.set(key, group);
      } else {
        counts.uncorrelatedRequests++;
      }

      requests.push(complete);
    }
  }

  const summaries = [...groups.values()].map((group) => {
    const values = group.requests;
    const { correlation } = group;
    return {
      ...correlation,
      requestCount: values.length,
      coveredIntervalUnionMs: distribution(values.map((request) => request.coveredIntervalUnionMs)),
      stages: [...new Set(values.flatMap((request) => request.stages.map((span) => span.stage)))]
        .sort()
        .map((stage) => {
          const observed = values.flatMap((request) =>
            request.stages.filter((span) => span.stage === stage),
          );
          return {
            stage,
            observedRequests: observed.length,
            eventCount: distribution(observed.map((span) => span.eventCount)),
            inclusiveDurationMs: distribution(observed.map((span) => span.inclusiveDurationMs)),
            intervalUnionMs: distribution(observed.map((span) => span.intervalUnionMs)),
            ...(stage === 'local.write' ? { aggregation: 'serialized-write-duration' } : {}),
          };
        }),
    };
  });

  return {
    schemaVersion: 1,
    protocol: 'restoration-trace-summary-v1',
    jobId: trace.jobId,
    runtime,
    arms,
    interpretation: {
      status: 'descriptive-diagnostic-only',
      performanceDecision: 'unavailable',
      overlappingIntervals:
        'Inclusive stage durations overlap. Their sum is not elapsed wall time; intervals are retained.',
      body: 'artifact.body includes consumer backpressure from local hashing and writes; it is not pure network transfer time.',
      union:
        'Covered interval union is traced coverage, not an exclusive critical path or complete request duration.',
      population:
        'Stage distributions use requests, not concurrent batches; absent stages are not imputed as zero.',
      writes: 'local.write reports the sum of serialized write intervals within each request.',
    },
    counts,
    primary: summaries.filter((group) => group.exclusion === 'measured'),
    excluded: summaries.filter((group) => group.exclusion !== 'measured'),
    requests,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [traceFile, resultFile, output, ...extra] = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
    if (!traceFile || !resultFile || extra.length) {
      fail('usage:trace-analysis trace.json result.json [output.json]');
    }

    const report = summarizeTrace(
      JSON.parse(await readFile(traceFile, 'utf8')),
      JSON.parse(await readFile(resultFile, 'utf8')),
    );
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (output) {
      await writeFile(output, json);
    } else {
      process.stdout.write(json);
    }
  } catch (error) {
    // Filesystem and JSON parser messages can contain private input: expose no raw error.
    const code =
      error instanceof Error &&
      /^(invalid-trace-[a-z-]+|trace-[a-z-]+|overlapping-local-writes|usage:trace-analysis trace.json result.json \[output.json\])$/.test(
        error.message,
      )
        ? error.message
        : 'trace-analysis-failed';
    process.stderr.write(`${code}\n`);
    process.exitCode = ExitCode.Failure;
  }
}
