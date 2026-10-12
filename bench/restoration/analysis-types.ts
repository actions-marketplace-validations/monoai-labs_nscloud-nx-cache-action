/**
 * Define accepted benchmark documents, paired groups and analysis reports.
 * The analyzer needs explicit incomplete and measured states so missing evidence
 * cannot be treated as a qualified comparison; trace correlation uses the same
 * arm and sample identities.
 *
 * Imported by analysis code and tests; this module is not a command.
 */

import type { TraceCounters, TraceStage } from '../../src/trace.js';
import type {
  BenchmarkArm,
  SampleExclusion,
  AnalysisMode,
  RestorationLane,
} from './benchmark-policy.js';
import type { CacheTier } from '../../src/metrics.js';

export type Arm = (typeof BenchmarkArm)[keyof typeof BenchmarkArm];

export type Exclusion = (typeof SampleExclusion)[keyof typeof SampleExclusion];

export type AnalysisKind = (typeof AnalysisMode)[keyof typeof AnalysisMode];

export interface Sample {
  jobId: string;
  pair: number;
  arm: Arm;
  profileId: string;
  concurrency: number;
  lane: (typeof RestorationLane)[keyof typeof RestorationLane];
  population: number;
  durationMs: number;
  bytes: number;
  valid: boolean;
  excluded?: Exclusion;
  proof: {
    tier: typeof CacheTier.Artifact | typeof CacheTier.Local | 'mixed';
    digest: string;
    noPublication: boolean;
    completeBody: boolean;
  };
}

export interface ResultDocument {
  schemaVersion: 1;
  protocol: 'restoration-v1' | 'restoration-perf-v1';
  jobId: string;
  runtime: {
    node: string;
    nx: string;
    pnpm?: string;
    sdk?: string;
    platform: string;
    arch: string;
    runnerProfile: string;
    region: string;
  };
  baseline: { revision: string; digest: string };
  candidate: { revision: string; digest: string };
  corpusDigest: string;
  samples: Sample[];
  failures: string[];
  weights?: Record<string, number>;
  preparation?: Record<string, unknown>;
}

export interface GroupIdentity {
  profileId: string;
  concurrency: number;
  lane: Sample['lane'];
  population: number;
}

export interface Pair {
  baseline: Sample;
  candidate: Sample;
}

export interface Group {
  identity: GroupIdentity;
  pairs: Map<string, Partial<Pair>>;
  excluded: Record<Exclusion, number>;
  excludedSamples: Sample[];
}

export interface Interval {
  low: number;
  high: number;
}

export interface Comparison {
  baseline: number;
  candidate: number;
  absoluteMs: number;
  relative: number;
  absoluteMs95: Interval;
  relative95: Interval;
  margins: { absoluteMs: number; relative: number };
  decision: 'regression' | 'within-margin' | 'inconclusive';
}

export interface GroupEvidence extends GroupIdentity {
  evidence: { pairs: number; jobs: number; pairsPerJob: number[] };
  excluded: Record<Exclusion, number>;
  excludedTimingsMs: Record<
    Exclusion,
    Record<Arm, { count: number; median?: number; range?: number[] }>
  >;
}

export interface IncompleteGroup extends GroupEvidence {
  status: 'incomplete';
  required: { pairs: number; jobs: number; pairsPerJob: number };
}

export interface MeasuredGroup extends GroupEvidence {
  status: 'passed' | 'failed' | 'inconclusive';
  median: Comparison;
  p95: Comparison;
  meanCompressedBytes: number;
  baselineRangeMs: number[];
  candidateRangeMs: number[];
  medianPairedDifferenceMs: number;
  limitation: string;
}

export type GroupSummary = IncompleteGroup | MeasuredGroup;

export interface TraceCorrelation {
  arm: Arm;
  profileId: string;
  concurrency: number;
  lane: 'adapter-remote' | 'adapter-local';
  population: number;
  exclusion: Exclusion | 'measured';
}

export interface TraceInterval {
  stage: TraceStage;
  startMs: number;
  durationMs: number;
  counters?: TraceCounters;
}

export interface TraceRequest {
  requestId: string;
  arm: Arm;
  pid: number;
  intervals: TraceInterval[];
  correlation?: TraceCorrelation;
  coveredIntervalUnionMs: number;
  stages: {
    stage: TraceStage;
    eventCount: number;
    inclusiveDurationMs: number;
    intervalUnionMs: number;
    aggregation?: string;
  }[];
}
