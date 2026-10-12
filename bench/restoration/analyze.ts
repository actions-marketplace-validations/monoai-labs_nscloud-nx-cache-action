/**
 * Analyze paired restoration blocks with schema and statistical qualification gates.
 * Separate job blocks, excluded samples and per-cohort comparisons prevent pooled
 * or incomplete evidence from hiding a median or p95 regression.
 *
 * Run: pnpm exec tsx bench/restoration/analyze.ts [--tracing-overhead] <block.json> ...
 * Writes JSON to stdout and returns nonzero for failed, incomplete or inconclusive results.
 */

import type {
  Interval,
  Comparison,
  Exclusion,
  Arm,
  AnalysisKind,
  Sample,
  ResultDocument,
  Pair,
  Group,
  GroupSummary,
} from './analysis-types.js';
import type { JSONSchemaType } from 'ajv';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Ajv } from 'ajv';
import {
  SampleExclusion,
  BenchmarkArm,
  RestorationLane,
  MIN_TOTAL_PAIRS,
  MIN_JOB_BLOCKS,
  MIN_PAIRS_PER_JOB,
  AnalysisMode,
  MEDIAN_QUANTILE,
  P95_QUANTILE,
} from './benchmark-policy.js';
import { NODE_USER_ARGUMENT_OFFSET, ExitCode } from '../../src/process-constants.js';
import { SECOND_MS } from '../../src/units.js';

const UINT32_VALUE_RANGE = 2 ** 32;
const MULBERRY32 = Object.freeze({
  StateIncrement: 0x6d2b79f5,
  InitialShift: 15,
  MixShift: 7,
  MultiplierMask: 61,
  OutputShift: 14,
});
const CONFIDENCE_LEVEL = 0.95;
const CONFIDENCE_INTERVAL_LOW_QUANTILE = 0.025;
const CONFIDENCE_INTERVAL_HIGH_QUANTILE = 0.975;
const MEDIAN_MARGIN_MS = 10;
const INVOCATION_MEDIAN_MARGIN_MS = 100;
const MEDIAN_RELATIVE_MARGIN = 0.1;
const P95_MARGIN_MS = 25;
const P95_RELATIVE_MARGIN = 0.15;
const MIN_BOOTSTRAP_REPLICATES = 100;
const MAX_BOOTSTRAP_REPLICATES = 10_000;
const DEFAULT_BOOTSTRAP_REPLICATES = 1000;
const DEFAULT_BOOTSTRAP_SEED = 0x4e585231;
const VALID_ANALYSIS_MODES: readonly AnalysisKind[] = [
  AnalysisMode.Performance,
  AnalysisMode.TracingOverhead,
];

const definition: JSONSchemaType<ResultDocument> = JSON.parse(
  await readFile(new URL('../../schemas/restoration-result.schema.json', import.meta.url), 'utf8'),
);
const validate = new Ajv({ strict: false, allErrors: true }).compile(definition);

const runtimeKeys: (keyof ResultDocument['runtime'])[] = [
  'node',
  'nx',
  'pnpm',
  'sdk',
  'platform',
  'arch',
  'runnerProfile',
  'region',
];

/** Returns schema error codes only; never returns input values or provider errors. */
export function validateResult(document: unknown): string[] {
  if (validate(document)) {
    return [];
  }

  return [...new Set((validate.errors ?? []).map((error) => `schema:${error.keyword}`))];
}

export function quantile(values: number[], probability: number) {
  if (!values.length) {
    throw new Error('Empty statistical population');
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const left = sorted[lower];
  const right = sorted[Math.ceil(index)];
  if (left === undefined || right === undefined) {
    throw new Error('Invalid statistical probability');
  }

  return left + (right - left) * (index - lower);
}

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += MULBERRY32.StateIncrement;
    let value = state;
    value = Math.imul(value ^ (value >>> MULBERRY32.InitialShift), value | 1);
    value ^=
      value + Math.imul(value ^ (value >>> MULBERRY32.MixShift), value | MULBERRY32.MultiplierMask);

    return ((value ^ (value >>> MULBERRY32.OutputShift)) >>> 0) / UINT32_VALUE_RANGE;
  };
}

function measurement(pairs: Pair[], probability: number) {
  const baseline = quantile(
    pairs.map((pair) => pair.baseline.durationMs),
    probability,
  );
  const candidate = quantile(
    pairs.map((pair) => pair.candidate.durationMs),
    probability,
  );

  return {
    baseline,
    candidate,
    absoluteMs: candidate - baseline,
    relative: (candidate - baseline) / baseline,
  };
}

function interval(values: number[]) {
  return {
    low: quantile(values, CONFIDENCE_INTERVAL_LOW_QUANTILE),
    high: quantile(values, CONFIDENCE_INTERVAL_HIGH_QUANTILE),
  };
}

function gate(
  absolute: Interval,
  relative: Interval,
  absoluteMargin: number,
  relativeMargin: number,
): Comparison['decision'] {
  if (absolute.low > absoluteMargin && relative.low > relativeMargin) {
    return 'regression';
  }
  if (absolute.high <= absoluteMargin || relative.high <= relativeMargin) {
    return 'within-margin';
  }

  return 'inconclusive';
}

function comparison(
  pairs: Pair[],
  replicates: Pair[][],
  probability: number,
  absoluteMargin: number,
  relativeMargin: number,
) {
  const point = measurement(pairs, probability);
  const absoluteMs95 = interval(
    replicates.map((sample) => measurement(sample, probability).absoluteMs),
  );
  const relative95 = interval(
    replicates.map((sample) => measurement(sample, probability).relative),
  );

  return {
    ...point,
    absoluteMs95,
    relative95,
    margins: { absoluteMs: absoluteMargin, relative: relativeMargin },
    decision: gate(absoluteMs95, relative95, absoluteMargin, relativeMargin),
  };
}

function groupIdentity(sample: Sample) {
  return JSON.stringify([sample.profileId, sample.concurrency, sample.lane, sample.population]);
}

function comparableIdentity(document: ResultDocument) {
  return JSON.stringify({
    protocol: document.protocol,
    runtime: runtimeKeys.map((key) => document.runtime[key] ?? null),
    baseline: [document.baseline.revision, document.baseline.digest],
    candidate: [document.candidate.revision, document.candidate.digest],
    corpusDigest: document.corpusDigest,
    weights: Object.entries(document.weights ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  });
}

function summarizeGroup(group: Group, iterations: number, random: () => number): GroupSummary {
  const pairs = [...group.pairs.values()].map((pair) => {
    if (!pair.baseline || !pair.candidate) {
      throw new Error('Incomplete statistical pair');
    }

    return { baseline: pair.baseline, candidate: pair.candidate };
  });

  const jobs: Map<string, Pair[]> = new Map();
  for (const pair of pairs) {
    const block = jobs.get(pair.baseline.jobId) ?? [];
    block.push(pair);
    jobs.set(pair.baseline.jobId, block);
  }

  const blocks = [...jobs.values()];
  const evidence = {
    pairs: pairs.length,
    jobs: blocks.length,
    pairsPerJob: blocks.map((block) => block.length).sort((left, right) => left - right),
  };

  const excludedTiming = (reason: Exclusion, arm: Arm) => {
    const values = group.excludedSamples
      .filter((sample) => sample.excluded === reason && sample.arm === arm)
      .map((sample) => sample.durationMs);
    return values.length
      ? {
          count: values.length,
          median: quantile(values, MEDIAN_QUANTILE),
          range: [Math.min(...values), Math.max(...values)],
        }
      : { count: 0 };
  };
  const excludedTimingsMs = {
    [SampleExclusion.FirstAccess]: {
      baseline: excludedTiming(SampleExclusion.FirstAccess, BenchmarkArm.Baseline),
      candidate: excludedTiming(SampleExclusion.FirstAccess, BenchmarkArm.Candidate),
    },
    warmup: {
      baseline: excludedTiming(SampleExclusion.Warmup, BenchmarkArm.Baseline),
      candidate: excludedTiming(SampleExclusion.Warmup, BenchmarkArm.Candidate),
    },
  };
  const base = { ...group.identity, evidence, excluded: group.excluded, excludedTimingsMs };
  if (
    pairs.length < MIN_TOTAL_PAIRS ||
    blocks.length < MIN_JOB_BLOCKS ||
    blocks.some((block) => block.length < MIN_PAIRS_PER_JOB)
  ) {
    return {
      ...base,
      status: 'incomplete',
      required: { pairs: MIN_TOTAL_PAIRS, jobs: MIN_JOB_BLOCKS, pairsPerJob: MIN_PAIRS_PER_JOB },
    };
  }

  const replicates = Array.from({ length: iterations }, () =>
    Array.from({ length: blocks.length }, () => {
      const block = blocks[Math.floor(random() * blocks.length)];
      if (!block) {
        throw new Error('Missing statistical block');
      }

      return block;
    }).flat(),
  );
  const median = comparison(
    pairs,
    replicates,
    MEDIAN_QUANTILE,
    group.identity.lane === RestorationLane.MixedInvocation
      ? INVOCATION_MEDIAN_MARGIN_MS
      : MEDIAN_MARGIN_MS,
    MEDIAN_RELATIVE_MARGIN,
  );
  const p95 = comparison(pairs, replicates, P95_QUANTILE, P95_MARGIN_MS, P95_RELATIVE_MARGIN);
  const status = [median, p95].some((value) => value.decision === 'regression')
    ? 'failed'
    : [median, p95].some((value) => value.decision === 'inconclusive')
      ? 'inconclusive'
      : 'passed';

  return {
    ...base,
    status,
    median,
    p95,
    meanCompressedBytes: pairs.reduce((sum, pair) => sum + pair.baseline.bytes, 0) / pairs.length,
    baselineRangeMs: [
      Math.min(...pairs.map((pair) => pair.baseline.durationMs)),
      Math.max(...pairs.map((pair) => pair.baseline.durationMs)),
    ],
    candidateRangeMs: [
      Math.min(...pairs.map((pair) => pair.candidate.durationMs)),
      Math.max(...pairs.map((pair) => pair.candidate.durationMs)),
    ],
    medianPairedDifferenceMs: quantile(
      pairs.map((pair) => pair.candidate.durationMs - pair.baseline.durationMs),
      MEDIAN_QUANTILE,
    ),
    limitation:
      'Whole runner/job blocks are resampled with paired arms intact; three blocks provide limited interval precision. Provider locality is uncontrolled.',
  };
}

function weightedSummaries(groups: GroupSummary[], weights: Record<string, number> | undefined) {
  if (!weights || !Object.keys(weights).length) {
    return {
      status: 'unavailable',
      reason: 'No configured workload weights were supplied',
      cohorts: [],
    };
  }

  const configuredProfiles = Object.keys(weights).length;
  const configuredAttempts = Object.values(weights).reduce((sum, weight) => sum + weight, 0);

  const cohorts: Map<
    string,
    { lane: Sample['lane']; concurrency: number; population: number; groups: GroupSummary[] }
  > = new Map();
  for (const group of groups) {
    const key = JSON.stringify([group.lane, group.concurrency, group.population]);
    const cohort = cohorts.get(key) ?? {
      lane: group.lane,
      concurrency: group.concurrency,
      population: group.population,
      groups: [],
    };
    cohort.groups.push(group);
    cohorts.set(key, cohort);
  }

  return {
    status: 'available',
    productionRepresentative: false,
    basis:
      'Configured synthetic workload weights; weighted means of profile medians, not production invocation percentiles. Stress profiles, populations and concurrency remain separate.',
    cohorts: [...cohorts.values()].map(({ groups: members, ...cohort }) => {
      const included = members.flatMap((group) => {
        const weight = weights[group.profileId];
        return weight === undefined ? [] : [{ group, weight }];
      });

      const unweightedProfiles = members.length - included.length;
      const includedAttempts = included.reduce((sum, member) => sum + member.weight, 0);
      const coverage = {
        configuredProfiles,
        includedProfiles: included.length,
        configuredAttempts,
        includedAttempts,
        attemptFraction: includedAttempts / configuredAttempts,
      };
      const scope =
        included.length === configuredProfiles
          ? 'all-configured-profiles'
          : 'configured-profile-subset';

      if (!included.length || included.some(({ group }) => group.status === 'incomplete')) {
        return { ...cohort, scope, coverage, unweightedProfiles, status: 'incomplete' };
      }

      const measured = included.flatMap(({ group, weight }) =>
        group.status === 'incomplete' ? [] : [{ group, weight }],
      );
      const transferredBytes = measured.reduce(
        (sum, { group, weight }) => sum + weight * group.meanCompressedBytes,
        0,
      );

      const arm = (name: Arm) => {
        const weightedTimeMs = measured.reduce(
          (sum, { group, weight }) => sum + weight * group.median[name],
          0,
        );

        return {
          attemptWeightedProfileMedianMs: weightedTimeMs / includedAttempts,
          weightedBytesPerSecond: (transferredBytes * SECOND_MS) / weightedTimeMs,
          byteWeightedProfileBytesPerSecond:
            measured.reduce(
              (sum, { group, weight }) =>
                sum + (weight * group.meanCompressedBytes ** 2 * SECOND_MS) / group.median[name],
              0,
            ) / transferredBytes,
        };
      };

      return {
        ...cohort,
        scope,
        coverage,
        unweightedProfiles,
        status: 'descriptive',
        baseline: arm(BenchmarkArm.Baseline),
        candidate: arm(BenchmarkArm.Candidate),
      };
    }),
  };
}

/** Analyze a single frozen protocol/cohort. All failed observations stay hard gates. */
export function analyzeResults(
  documents: unknown[],
  {
    iterations = DEFAULT_BOOTSTRAP_REPLICATES,
    seed = DEFAULT_BOOTSTRAP_SEED,
    kind = AnalysisMode.Performance,
  }: { iterations?: number; seed?: number; kind?: AnalysisKind } = {},
): {
  schemaVersion: 1;
  status: 'failed' | 'incomplete' | 'inconclusive' | 'passed';
  issues: string[];
  groups: GroupSummary[];
  method: {
    iterations: number;
    seed: number;
    confidence: number;
    resampling: string;
    protocol: ResultDocument['protocol'];
    kind: AnalysisKind;
    quantile: string;
  };
  weighted?: ReturnType<typeof weightedSummaries>;
} {
  if (!VALID_ANALYSIS_MODES.includes(kind)) {
    throw new Error('Invalid analysis kind');
  }
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_BOOTSTRAP_REPLICATES ||
    iterations > MAX_BOOTSTRAP_REPLICATES ||
    !Number.isInteger(seed)
  ) {
    throw new Error('Invalid analysis parameters');
  }

  const issues: string[] = [];
  const groups: Map<string, Group> = new Map();
  let identity: string | undefined;
  let weights: Record<string, number> | undefined;
  let protocol: ResultDocument['protocol'] | undefined;

  for (const document of documents) {
    if (!validate(document)) {
      issues.push(...new Set((validate.errors ?? []).map((error) => `schema:${error.keyword}`)));
      continue;
    }

    protocol ??= document.protocol;
    if (identity !== undefined && comparableIdentity(document) !== identity) {
      issues.push('incompatible-cohort');
      continue;
    }

    identity ??= comparableIdentity(document);
    weights ??= document.weights;
    if (document.failures.length) {
      issues.push('recorded-run-failure');
    }

    const trace = document.preparation?.trace;
    const traced =
      trace !== null &&
      typeof trace === 'object' &&
      'candidateEnabled' in trace &&
      Boolean(trace.candidateEnabled);
    if (kind === 'performance' && traced) {
      issues.push('traced-performance-comparison');
    }
    if (
      kind === AnalysisMode.TracingOverhead &&
      (!traced ||
        document.baseline.digest !== document.candidate.digest ||
        document.baseline.revision !== document.candidate.revision)
    ) {
      issues.push('invalid-tracing-overhead-control');
    }

    for (const sample of document.samples) {
      const expectedTier = sample.lane.includes('remote')
        ? 'artifact'
        : sample.lane.includes('local')
          ? 'local'
          : 'mixed';
      if (sample.jobId !== document.jobId) {
        issues.push('job-identity-mismatch');
      }
      if (
        !sample.valid ||
        !sample.proof.noPublication ||
        !sample.proof.completeBody ||
        sample.proof.tier !== expectedTier
      ) {
        issues.push('invalid-restore-proof');
      }

      const key = groupIdentity(sample);
      const group: Group = groups.get(key) ?? {
        identity: {
          profileId: sample.profileId,
          concurrency: sample.concurrency,
          lane: sample.lane,
          population: sample.population,
        },
        pairs: new Map(),
        excluded: { [SampleExclusion.FirstAccess]: 0, warmup: 0 },
        excludedSamples: [],
      };
      groups.set(key, group);
      if (sample.excluded) {
        group.excluded[sample.excluded] += 1;
        group.excludedSamples.push(sample);
        continue;
      }

      const pairKey = JSON.stringify([sample.jobId, sample.pair]);
      const pair: Partial<Pair> = group.pairs.get(pairKey) ?? {};
      if (pair[sample.arm]) {
        issues.push('duplicate-pair-arm');
      }

      pair[sample.arm] = sample;
      group.pairs.set(pairKey, pair);
    }
  }

  for (const group of groups.values()) {
    for (const pair of group.pairs.values()) {
      if (!pair.baseline || !pair.candidate) {
        issues.push('missing-pair-arm');
      } else if (
        pair.baseline.bytes !== pair.candidate.bytes ||
        pair.baseline.proof.digest !== pair.candidate.proof.digest
      ) {
        issues.push('pair-payload-mismatch');
      }
    }
  }

  const method = {
    iterations,
    seed,
    confidence: CONFIDENCE_LEVEL,
    resampling: 'whole-job-blocks',
    protocol: protocol ?? 'restoration-v1',
    kind,
    quantile: 'linear-interpolation',
  };
  if (issues.length) {
    return { schemaVersion: 1, status: 'failed', issues: [...new Set(issues)], groups: [], method };
  }
  if (!groups.size) {
    return {
      schemaVersion: 1,
      status: 'incomplete',
      issues: ['no-measured-pairs'],
      groups: [],
      method,
    };
  }

  const random = randomGenerator(seed);
  const results = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, group]) => summarizeGroup(group, iterations, random));
  const status = results.some((group) => group.status === 'failed')
    ? 'failed'
    : results.some((group) => group.status === 'incomplete')
      ? 'incomplete'
      : results.some((group) => group.status === 'inconclusive')
        ? 'inconclusive'
        : 'passed';

  return {
    schemaVersion: 1,
    status,
    issues: [],
    groups: results,
    weighted: weightedSummaries(results, weights),
    method,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const paths = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
    const kind =
      paths[0] === '--tracing-overhead' ? (paths.shift(), 'tracing-overhead') : 'performance';
    if (!paths.length) {
      throw new Error('No result paths');
    }

    const documents = await Promise.all(
      paths.map(async (filename) => JSON.parse(await readFile(filename, 'utf8'))),
    );
    const result = analyzeResults(documents, { kind });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === 'passed' ? ExitCode.Success : ExitCode.Failure;
  } catch {
    process.stdout.write(
      `${JSON.stringify({ schemaVersion: 1, status: 'failed', issues: ['result-input-error'], groups: [] })}\n`,
    );
    process.exitCode = ExitCode.Failure;
  }
}
