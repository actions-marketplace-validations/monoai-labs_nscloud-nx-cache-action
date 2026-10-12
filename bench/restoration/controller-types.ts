/**
 * Define the controller's worker, fixture, sample and cleanup evidence contracts.
 * Explicit proof fields connect HTTP restoration, native extraction and owned
 * process cleanup so the controller records correctness alongside measurements.
 *
 * Imported by run.ts and its tests; this module is not a command.
 */

import type { LocalStore } from '../../src/local-store.js';
import type { generateCorpus } from './fixture.js';
import type { parseCacheEvents } from './profile.js';
import type { processDelta } from './process-stats.js';
import type { seedFixtures } from './seed.js';
import type { parseTraceEvents } from './trace-parser.js';
import type { BenchmarkArm, RestorationLane, SampleExclusion } from './benchmark-policy.js';
import type { CacheTier } from '../../src/metrics.js';

export type Fixture = Awaited<ReturnType<typeof generateCorpus>>['fixtures'][number];

export type CacheEvent = ReturnType<typeof parseCacheEvents>[number];

export type TraceEvent = ReturnType<typeof parseTraceEvents>[number];

export type Arm = (typeof BenchmarkArm)[keyof typeof BenchmarkArm];

export type Tier = typeof CacheTier.Local | typeof CacheTier.Artifact;

export type AdapterLane =
  | typeof RestorationLane.AdapterLocal
  | typeof RestorationLane.AdapterRemote;

export type NativeLane = typeof RestorationLane.NxLocal | typeof RestorationLane.NxRemote;

export interface OrderEntry {
  profileId: string;
  concurrency: number;
  pair: number;
  lane: AdapterLane;
  excluded?: (typeof SampleExclusion)[keyof typeof SampleExclusion];
  arms: [Arm, Arm];
}

export interface ResponseProof {
  hash: string;
  status: number;
  bytes: Buffer;
}

export interface SampleInput {
  responses: ResponseProof[];
  fixtures: { hash: string; bytes: number; digest: string }[];
  events: CacheEvent[];
  tier: Tier;
}

export interface BundleWorker {
  url: string;
  token: string;
  events: CacheEvent[];
  traces: TraceEvent[];
  serverPid: number;
  local: LocalStore;
  setupMs: number;
  close(): Promise<void>;
  checkEvents(): void;
}

export interface BundleOptions {
  bundle: string;
  directory: string;
  archive: string;
  prefix?: string;
  region?: string;
  trace?: boolean;
  signal?: AbortSignal;
}

export interface ControllerOptions {
  protocol?: string;
  pairs?: number;
  population?: number;
  offline?: boolean;
  runId?: string;
  jobId?: string;
  budgetMs?: number;
  output?: string;
  region?: string;
  baseline?: string;
  candidate?: string;
  baselineRevision?: string;
  candidateRevision?: string;
  traceCandidate?: boolean;
  corpusFile?: string;
  all?: boolean;
}

export interface ExitOutcome {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface TreeFile {
  path: string;
  mode: number;
  size: number;
  digest: string;
}

export interface TreeDirectory {
  path: string;
  mode: number;
}

export interface NativeProof {
  files: number;
  directories: number;
  retrieveMs: number;
  verified: true;
  terminalReplay: true;
  codeReplay: true;
  taskExecutions: 0;
  scope: string;
}

export interface RunnerEvidence {
  device: string;
  filesystemRoot: string;
  filesystem: string;
  target: string;
  filesystemDevice: string;
  rootFilesystemDevice: string;
  separateFromRootFilesystem: true;
  scope: string;
  providerParentFilesystemDevice?: string;
  providerParentDeviceAgreement?: boolean;
  providerParentDeviceAvailable?: boolean;
}

interface BundleMetadata {
  revision: string;
  digest: string;
}

interface Inventory {
  entries: number;
  totalArchiveBytes: number;
  quantileTargets: [number, number][];
}

interface Preparation {
  budgetMs: number;
  offline: boolean;
  productionRepresentative: false;
  replaySequenceAvailable: false;
  spans: string;
  memory: string;
  populationProfile: string;
  firstAccessDefinition: string;
  orderSeed?: string;
  prefix?: string;
  seed?: Awaited<ReturnType<typeof seedFixtures>>;
  baselineInventory?: Inventory;
  candidateInventory?: Inventory;
  baselineSetupMs?: number;
  candidateSetupMs?: number;
  baselineCloseMs?: number;
  candidateCloseMs?: number;
  trace?: { candidateEnabled: true; file: string; scope: string };
  ownedCleanupVerified?: boolean;
}

interface Sample {
  jobId: string;
  pair: number;
  arm: Arm;
  profileId: string;
  concurrency: number;
  lane: AdapterLane;
  population: number;
  durationMs: number;
  serverDurationMs: number;
  clientCpuUserMicros: number;
  clientCpuSystemMicros: number;
  clientRssBytes: number;
  adapterProcess: ReturnType<typeof processDelta>;
  traceRequestIds?: string[];
  valid: true;
  excluded?: OrderEntry['excluded'];
  bytes: number;
  proof: { tier: Tier; digest: string; noPublication: true; completeBody: true };
}

type CalibrationFields =
  | 'compressedBytes'
  | 'expandedTarBytes'
  | 'fileCount'
  | 'directoryCount'
  | 'maxDepth'
  | 'outputBytes'
  | 'metadataBytes'
  | 'fileSizeBytes'
  | 'depthCounts'
  | 'directoryChildCounts';

export interface ControllerResult {
  schemaVersion: 1;
  protocol: string;
  jobId: string;
  productionRepresentative: false;
  replaySequenceAvailable: false;
  runtime: {
    node: string;
    nx: string;
    pnpm: string;
    sdk: string;
    platform: NodeJS.Platform;
    arch: string;
    runnerProfile: string;
    region: string;
    runnerEvidence?: RunnerEvidence;
  };
  baseline?: BundleMetadata;
  candidate?: BundleMetadata;
  corpusDigest?: string;
  weights?: Record<string, number>;
  calibration?: {
    qualified: true;
    selectedProfiles: number;
    synthetic: true;
    broaderCensusPending: true;
    profiles: (Pick<Fixture, 'profileId' | 'digest' | 'exactLayout'> &
      Pick<Fixture['calibration'], CalibrationFields>)[];
  };
  samples: Sample[];
  failures: string[];
  order: OrderEntry[];
  timestamps: { started: string; finished?: string };
  acceptance: {
    samples: (NativeProof & {
      arm: Arm;
      profileId: string;
      lane: NativeLane;
      durationMs: number;
    })[];
    verified?: true;
  };
  preparation: Preparation;
  failureContext?: {
    stage: string;
    arm: Arm;
    profileId: string;
    lane: AdapterLane | NativeLane;
    pair?: number;
    concurrency?: number;
  };
  failureSample?: {
    expectedTier: Tier;
    expected: SampleInput['fixtures'];
    responses: { hash: string; status: number; bytes: number; digest: string }[];
    events: CacheEvent[];
  };
}
