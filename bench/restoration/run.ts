/**
 * Coordinate paired restores through the actual baseline and candidate bundles.
 * Recorded arm order, cold client state, tier/digest checks and native extraction
 * proofs keep correctness tied to each measurement. The controller also records
 * runner evidence and reaps only the workers and local resources it creates.
 *
 * Run: pnpm bench:restoration:live with the options documented in docs/benchmarking.md.
 * Needs: built bundles and Namespace credentials for remote lanes; --offline runs
 * local harness controls. Writes block evidence to results/ and uses expiring owned Artifacts.
 */

import type {
  OrderEntry,
  AdapterLane,
  SampleInput,
  Tier,
  BundleOptions,
  BundleWorker,
  CacheEvent,
  TraceEvent,
  ExitOutcome,
  RunnerEvidence,
  Fixture,
  TreeFile,
  TreeDirectory,
  NativeProof,
  NativeLane,
  ControllerOptions,
  ControllerResult,
  Arm,
  ResponseProof,
} from './controller-types.js';
import type * as NativeTypes from 'nx/src/native';

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { generateCorpus, readCorpus, sha256 } from './fixture.js';
import { parseCacheEvents } from './profile.js';
import { LocalStore } from '../../src/local-store.ts';
import { seedFixtures } from './seed.ts';
import { parseTraceEvents } from './trace-parser.js';
import { snapshotProcess, processDelta } from './process-stats.js';
import { SECOND_MS, MINUTE_MS, KIBIBYTE, MEBIBYTE } from '../../src/units.js';
import {
  DEFAULT_MEASURED_PAIRS,
  MAX_MEASURED_PAIRS,
  EXCLUDED_PAIRS_PER_LANE,
  PARALLEL_RESTORATION_REQUESTS,
  FIXTURE_REPLICAS,
  MAX_INVENTORY_POPULATION,
  SEED_EXPIRATION_HOURS,
  RestorationLane,
  SampleExclusion,
  BenchmarkArm,
} from './benchmark-policy.js';
import {
  PROCESS_EXISTENCE_PROBE,
  ProcessSignal,
  NODE_USER_ARGUMENT_OFFSET,
  ExitCode,
} from '../../src/process-constants.js';
import { CacheOperation, CacheTier } from '../../src/metrics.js';
import { HttpStatus } from '../../src/http.js';
import { CacheFailureMode, CacheAccess } from '../../src/config.js';
import { FilePermissions } from '../../src/filesystem.js';

const INVENTORY_PAYLOAD_FILL_PERIOD = 251;

const WORKER_LOG_LINE_LIMIT_BYTES = MEBIBYTE;
const WORKER_TRACE_EVENT_LIMIT = 200_000;
const WORKER_SHUTDOWN_GRACE_MS = 5 * SECOND_MS;
const WORKER_POLL_INTERVAL_MS = 10;
const PROCESS_REAP_ATTEMPTS = SECOND_MS / WORKER_POLL_INTERVAL_MS;
const WORKER_READY_TIMEOUT_MS = 30 * SECOND_MS;
const CACHE_EVENT_TIMEOUT_MS = 2 * SECOND_MS;
const CACHE_EVENT_POLL_INTERVAL_MS = 2;
const NATIVE_PROOF_OUTPUT_LIMIT_BYTES = 64 * KIBIBYTE;
const DEFAULT_RUN_BUDGET_MS = 19 * MINUTE_MS;
const MAX_RUN_BUDGET_MS = 20 * MINUTE_MS;
const MIN_RUN_BUDGET_MS = 100;
const RESTORATION_REQUEST_TIMEOUT_MS = 2 * MINUTE_MS;

const require = createRequire(import.meta.url);
const { HttpRemoteCache }: typeof NativeTypes = require('nx/src/native');
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const workerFile = new URL('./worker.ts', import.meta.url);

class BenchmarkFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function fail(code: string): never {
  throw new BenchmarkFailure(code);
}

const failureCode = (error: unknown) =>
  error instanceof BenchmarkFailure ? error.code : 'controller-failure';

function checkBudget(signal: AbortSignal) {
  if (signal.aborted) {
    fail('run-budget-exhausted');
  }
}

function processAlive(pid: number) {
  try {
    process.kill(pid, PROCESS_EXISTENCE_PROBE);

    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return false;
    }

    fail('owned-process-probe-failure');
  }
}

/** Order is frozen before reading either arm's timings and can be replayed exactly. */
export function buildOrder(
  profiles: { profileId: string }[],
  {
    pairs = DEFAULT_MEASURED_PAIRS,
    seed = 'restoration-v1',
    offline = false,
  }: { pairs?: number; seed?: string; offline?: boolean } = {},
): OrderEntry[] {
  const entries: OrderEntry[] = [];
  for (const fixture of profiles) {
    for (const concurrency of [1, PARALLEL_RESTORATION_REQUESTS]) {
      for (let pair = 0; pair < pairs + EXCLUDED_PAIRS_PER_LANE; pair++) {
        const lanes: AdapterLane[] = offline
          ? [RestorationLane.AdapterLocal]
          : [RestorationLane.AdapterRemote, RestorationLane.AdapterLocal];
        for (const lane of lanes) {
          const bit =
            createHash('sha256')
              .update(`${seed}:${fixture.profileId}:${concurrency}:${pair}:${lane}`)
              .digest()
              .readUInt8(0) & 1;
          entries.push({
            profileId: fixture.profileId,
            concurrency,
            pair,
            lane,
            ...(pair < EXCLUDED_PAIRS_PER_LANE
              ? { excluded: pair === 0 ? SampleExclusion.FirstAccess : SampleExclusion.Warmup }
              : {}),
            arms: bit
              ? [BenchmarkArm.Baseline, BenchmarkArm.Candidate]
              : [BenchmarkArm.Candidate, BenchmarkArm.Baseline],
          });
        }
      }
    }
  }

  return entries;
}

/** Tier, payload, publication and body proofs are gates, never performance filters. */
export function assertSampleProof({ responses, fixtures, events, tier }: SampleInput): {
  bytes: number;
  proof: { tier: Tier; digest: string; noPublication: true; completeBody: true };
} {
  if (responses.length !== fixtures.length) {
    fail('incomplete-response-batch');
  }
  if (
    events.some(
      (event) =>
        event.operation === CacheOperation.Put || event.operation === CacheOperation.Publish,
    )
  ) {
    fail('unexpected-publication');
  }
  if (events.some((event) => event.tier !== CacheTier.Local && event.tier !== CacheTier.Artifact)) {
    fail('unexpected-cache-event');
  }

  const digests = [];
  let bytes = 0;
  for (const fixture of fixtures) {
    const response = responses.find((value) => value.hash === fixture.hash);
    if (!response || response.status !== HttpStatus.Ok) {
      fail('restore-http-status');
    }

    const digest = sha256(response.bytes);
    if (response.bytes.length !== fixture.bytes || digest !== fixture.digest) {
      fail('restore-body-mismatch');
    }

    const gets = events.filter(
      (event) => event.operation === CacheOperation.Get && event.hash === fixture.hash,
    );
    const [get] = gets;
    if (gets.length !== 1 || !get || get.tier !== tier || get.bytes !== fixture.bytes) {
      fail('restore-tier-mismatch');
    }

    bytes += response.bytes.length;
    digests.push(digest);
  }

  if (events.filter((event) => event.operation === CacheOperation.Get).length !== fixtures.length) {
    fail('unexpected-get-count');
  }

  const [singleDigest] = digests;

  return {
    bytes,
    proof: {
      tier,
      digest:
        digests.length === 1 && singleDigest !== undefined
          ? singleDigest
          : sha256(Buffer.from(digests.join('\n'))),
      noPublication: true,
      completeBody: true,
    },
  };
}

/** Retain only structured facts about the failed batch, never response bodies or credentials. */
export function captureFailureSample({ responses, fixtures, events, tier }: SampleInput) {
  return {
    expectedTier: tier,
    expected: fixtures.map((fixture) => ({
      hash: fixture.hash,
      bytes: fixture.bytes,
      digest: fixture.digest,
    })),
    responses: responses.map((response) => ({
      hash: response.hash,
      status: response.status,
      bytes: response.bytes.length,
      digest: sha256(response.bytes),
    })),
    events: events.flatMap((event) =>
      parseCacheEvents(JSON.stringify({ cache: event }), { includeHashes: true }),
    ),
  };
}

function ownedEnvironment(
  archive: string,
  prefix: string | undefined,
  region: string,
  trace: boolean,
) {
  const env = { ...process.env };
  for (const name of [
    'NX_ARTIFACT_PREFIX',
    'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
    'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
    'GITHUB_STEP_SUMMARY',
    'NX_SKIP_NX_CACHE',
    'NX_CACHE_ACCESS',
    'NX_CACHE_REMOTE_ACCESS',
    'NX_CACHE_TRACE',
  ]) {
    delete env[name];
  }

  Object.assign(env, {
    NX_ARCHIVE_DIRECTORY: archive,
    NX_CACHE_FAILURE_MODE: CacheFailureMode.Strict,
    NX_CACHE_ACCESS: CacheAccess.ReadOnly,
    NX_CACHE_REMOTE_ACCESS: CacheAccess.ReadOnly,
    NX_ARTIFACT_REGION: region,
    NX_DAEMON: 'false',
  });
  if (prefix) {
    env.NX_ARTIFACT_PREFIX = prefix;
  }
  if (trace) {
    env.NX_CACHE_TRACE = '1';
  }

  return env;
}

/** Ready credentials and raw stderr exist only in this owned process/directory. */
export async function startBundleWorker({
  bundle,
  directory,
  archive,
  prefix,
  region = 'ord',
  trace = false,
  signal = new AbortController().signal,
}: BundleOptions): Promise<BundleWorker> {
  await mkdir(directory, { recursive: true });
  const readyFile = join(directory, 'ready.json');
  const stopFile = join(directory, 'stop');
  const events: CacheEvent[] = [];
  const traces: TraceEvent[] = [];
  let buffered = '';
  let parseFailure = false;

  const start = performance.now();
  const child = spawn(
    process.execPath,
    [
      resolve(bundle),
      process.execPath,
      '--import',
      'tsx',
      workerFile.pathname,
      readyFile,
      stopFile,
    ],
    {
      env: ownedEnvironment(archive, prefix, region, trace),
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );

  const closed: Promise<ExitOutcome> = new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => accept({ code, signal }));
  });
  // Register rejection handling immediately while readiness is polled.
  void closed.catch(() => {});
  child.stderr.on('data', (chunk) => {
    buffered += chunk.toString();
    if (buffered.length > WORKER_LOG_LINE_LIMIT_BYTES) {
      parseFailure = true;
      buffered = '';
    }

    let newline;
    while ((newline = buffered.indexOf('\n')) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);

      try {
        events.push(...parseCacheEvents(line, { includeHashes: true }));
        if (traces.length > WORKER_TRACE_EVENT_LIMIT) {
          throw new Error('Trace record limit');
        }

        traces.push(...parseTraceEvents(line));
      } catch {
        parseFailure = true;
      }
    }
  });

  let ready: unknown;
  let workerPid: number | undefined;
  let stopped = false;

  async function close() {
    if (stopped) {
      return;
    }

    stopped = true;
    let stopFailed = false;
    try {
      await writeFile(stopFile, 'stop', { mode: FilePermissions.OwnerOnlyFile });
    } catch {
      stopFailed = true;
      child.kill(ProcessSignal.Terminate);
    }

    let outcome = await Promise.race([
      closed,
      delay(WORKER_SHUTDOWN_GRACE_MS, undefined, { ref: false }).then(() => null),
    ]);
    if (!outcome) {
      child.kill(ProcessSignal.Terminate);
      outcome = await Promise.race([
        closed,
        delay(WORKER_SHUTDOWN_GRACE_MS, undefined, { ref: false }).then(() => null),
      ]);
    }

    if (!outcome) {
      // The worker belongs to this controller and advertises its own PID privately.
      if (workerPid && processAlive(workerPid)) {
        process.kill(workerPid, ProcessSignal.Kill);
      }

      child.kill(ProcessSignal.Kill);
      outcome = await closed;
    }

    if (child.pid && processAlive(child.pid)) {
      fail('wrapper-process-leaked');
    }
    if (workerPid && processAlive(workerPid)) {
      process.kill(workerPid, ProcessSignal.Kill);
      for (let attempt = 0; attempt < PROCESS_REAP_ATTEMPTS && processAlive(workerPid); attempt++) {
        await delay(WORKER_POLL_INTERVAL_MS);
      }

      if (processAlive(workerPid)) {
        fail('worker-process-leaked');
      }
    }

    if (stopFailed) {
      fail('worker-stop-file-failure');
    }
    if (outcome.code !== 0 || outcome.signal !== null) {
      fail('wrapper-exit-status');
    }
    if (parseFailure) {
      fail('cache-event-parse-failure');
    }
  }

  try {
    const readinessDeadline = performance.now() + WORKER_READY_TIMEOUT_MS;
    while (!ready) {
      checkBudget(signal);
      if (child.exitCode !== null || child.signalCode !== null) {
        fail('wrapper-startup-failure');
      }
      if (performance.now() > readinessDeadline) {
        fail('wrapper-readiness-timeout');
      }

      try {
        ready = JSON.parse(await readFile(readyFile, 'utf8'));
      } catch (error) {
        if (
          !(error instanceof Error && 'code' in error && error.code === 'ENOENT') &&
          !(error instanceof SyntaxError)
        ) {
          throw error;
        }
      }

      if (!ready) {
        await delay(WORKER_POLL_INTERVAL_MS);
      }
    }

    if (
      typeof ready !== 'object' ||
      ready === null ||
      !('url' in ready) ||
      typeof ready.url !== 'string' ||
      !/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(ready.url) ||
      !('token' in ready) ||
      typeof ready.token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(ready.token) ||
      !('pid' in ready) ||
      typeof ready.pid !== 'number' ||
      !Number.isSafeInteger(ready.pid) ||
      ready.pid < 2 ||
      child.pid === undefined
    ) {
      fail('invalid-private-ready-state');
    }

    workerPid = ready.pid;

    return {
      url: ready.url,
      token: ready.token,
      events,
      traces,
      serverPid: child.pid,
      local: new LocalStore(archive),
      setupMs: performance.now() - start,
      close,
      checkEvents: () => {
        if (parseFailure) {
          fail('cache-event-parse-failure');
        }
      },
    };
  } catch (error) {
    try {
      await close();
    } catch {}

    throw error;
  }
}

async function waitEvents(
  worker: BundleWorker,
  offset: number,
  count: number,
  signal: AbortSignal,
) {
  const deadline = performance.now() + CACHE_EVENT_TIMEOUT_MS;
  while (worker.events.length < offset + count) {
    checkBudget(signal);
    worker.checkEvents();
    if (performance.now() > deadline) {
      fail('cache-event-timeout');
    }

    await delay(CACHE_EVENT_POLL_INTERVAL_MS);
  }

  worker.checkEvents();

  return worker.events.slice(offset);
}

async function bundleMetadata(file: string, revision: string | undefined) {
  let selectedRevision = revision;
  if (!selectedRevision) {
    try {
      selectedRevision = (await readFile(join(dirname(file), 'revision.txt'), 'utf8')).trim();
    } catch {
      fail('missing-bundle-revision');
    }
  }
  if (!selectedRevision || !revisionPattern.test(selectedRevision)) {
    fail('invalid-bundle-revision');
  }

  const bytes = await readFile(file);
  const digest = sha256(bytes);
  const sums = await readFile(join(dirname(file), 'SHA256SUMS'), 'utf8');
  const expected = sums
    .split('\n')
    .map((line) => /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line))
    .find((match) => match && match[2] === basename(file));
  if (!expected || expected[1] !== digest) {
    fail('bundle-checksum-mismatch');
  }

  return { revision: selectedRevision, digest };
}

export const INVENTORY_QUANTILES: [number, number][] = [
  [0, 128],
  [0.5, KIBIBYTE],
  [0.9, 32 * KIBIBYTE],
  [0.95, 256 * KIBIBYTE],
  [0.99, 512 * KIBIBYTE],
  [1, 4 * MEBIBYTE],
];

export async function verifyMountEvidence(
  mount: unknown,
  archiveRoot: string,
  {
    deviceFor = async (file) => (await lstat(file, { bigint: true })).dev,
  }: { deviceFor?: (file: string) => Promise<bigint> } = {},
): Promise<RunnerEvidence> {
  if (
    typeof mount !== 'object' ||
    mount === null ||
    !('filesystems' in mount) ||
    !Array.isArray(mount.filesystems)
  ) {
    fail('invalid-mount-evidence');
  }

  const fields: unknown = mount.filesystems?.[0];
  if (
    typeof fields !== 'object' ||
    fields === null ||
    !('source' in fields) ||
    typeof fields.source !== 'string' ||
    !('fstype' in fields) ||
    typeof fields.fstype !== 'string' ||
    !/^[a-zA-Z0-9_-]+$/.test(fields.fstype) ||
    !('target' in fields) ||
    typeof fields.target !== 'string'
  ) {
    fail('invalid-mount-evidence');
  }

  const source = /^(\/dev\/[a-zA-Z0-9/_-]+)(?:\[(\/[a-zA-Z0-9/_.-]*)\])?$/.exec(fields.source);
  if (!source || source[1] === undefined) {
    fail('invalid-mount-evidence');
  }

  const target = await realpath(fields.target);
  const expected = await realpath(archiveRoot);
  if (target !== expected || target === '/') {
    fail('archive-mount-target-mismatch');
  }
  if (fields.fstype !== 'ext4') {
    fail('unsupported-cache-filesystem');
  }

  const device = await deviceFor(target);
  const rootDevice = await deviceFor('/');
  if (device === rootDevice) {
    fail('archive-on-root-filesystem');
  }

  return {
    device: source[1],
    filesystemRoot: source[2] ?? '/',
    filesystem: fields.fstype,
    target,
    filesystemDevice: String(device),
    rootFilesystemDevice: String(rootDevice),
    separateFromRootFilesystem: true,
    scope:
      'Configured Namespace cache bind mount and separate ext4 filesystem; physical NVMe identity is unverified and relies on the provider storage promise',
  };
}

export async function populateInventory(
  archive: string,
  population: number,
  signal: AbortSignal = new AbortController().signal,
) {
  const entries = join(archive, 'entries-v1');
  await mkdir(entries, { recursive: true });
  let totalBytes = 0;
  for (let index = 0; index < population; index++) {
    checkBudget(signal);
    const quantile = population > 1 ? index / (population - 1) : 0.5;
    const upper = INVENTORY_QUANTILES.findIndex((point) => point[0] >= quantile);
    const upperPoint = INVENTORY_QUANTILES[upper];
    const lowerPoint = INVENTORY_QUANTILES[Math.max(0, upper - 1)];
    if (!upperPoint || !lowerPoint) {
      fail('invalid-inventory-quantiles');
    }

    const [upperQuantile, upperSize] = upperPoint;
    const [lowerQuantile, lowerSize] = lowerPoint;
    const size = Math.round(
      lowerSize +
        (upperSize - lowerSize) *
          (upperQuantile === lowerQuantile
            ? 0
            : (quantile - lowerQuantile) / (upperQuantile - lowerQuantile)),
    );

    const bytes = Buffer.alloc(size, index % INVENTORY_PAYLOAD_FILL_PERIOD);
    totalBytes += size;

    const entry = join(entries, `inventory-${index}`);
    await mkdir(entry);
    await writeFile(join(entry, 'archive'), bytes, { mode: FilePermissions.OwnerOnlyFile });
    await writeFile(
      join(entry, 'metadata.json'),
      JSON.stringify({ version: 1, bytes: size, digest: sha256(bytes), createdAt: Date.now() }),
      { mode: FilePermissions.OwnerOnlyFile },
    );
  }

  return {
    entries: population,
    totalArchiveBytes: totalBytes,
    quantileTargets: INVENTORY_QUANTILES,
  };
}

async function seedLocal(local: LocalStore, fixtures: Fixture[]) {
  for (const fixture of fixtures) {
    await local.receive(
      fixture.hash,
      (async function* () {
        yield await readFile(fixture.file);
      })(),
    );
  }
}

async function verifyPersisted(worker: BundleWorker, fixtures: Fixture[]) {
  for (const fixture of fixtures) {
    const file = await worker.local.get(fixture.hash);
    if (!file || sha256(await readFile(file)) !== fixture.digest) {
      fail('persisted-archive-mismatch');
    }
  }
}

async function collectTree(
  directory: string,
  prefix: string = '',
): Promise<{ files: TreeFile[]; directories: TreeDirectory[] }> {
  const files = [];
  const directories = [];
  for (const name of await readdir(directory)) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const file = join(directory, name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) {
      fail('unexpected-restored-link');
    }
    if (info.isDirectory()) {
      directories.push({ path: relative, mode: info.mode & FilePermissions.Mask });
      const child = await collectTree(file, relative);
      files.push(...child.files);
      directories.push(...child.directories);
    } else if (info.isFile()) {
      files.push({
        path: relative,
        mode: info.mode & FilePermissions.Mask,
        size: info.size,
        digest: sha256(await readFile(file)),
      });
    } else {
      fail('unexpected-restored-node');
    }
  }

  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    directories: directories.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

/** Runs in a dedicated process: native retrieve has no cancellation API. */
export async function nativeOutputProof(fixture: Fixture, directory: string): Promise<NativeProof> {
  const client = new HttpRemoteCache();
  const retrievalStarted = performance.now();
  const restored = await client.retrieve(fixture.hash, directory);
  const retrieveMs = performance.now() - retrievalStarted;
  if (
    !restored ||
    restored.code !== fixture.code ||
    sha256(Buffer.from(restored.terminalOutput ?? '')) !== fixture.terminalDigest
  ) {
    fail('native-replay-mismatch');
  }

  const tree = await collectTree(restored.outputsPath);
  const expectedFiles = [...fixture.manifest].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  if (
    JSON.stringify(tree.files) !==
    JSON.stringify(
      expectedFiles.map((file) => ({
        path: file.path,
        mode: file.mode,
        size: file.size,
        digest: file.digest,
      })),
    )
  ) {
    fail('native-output-tree-mismatch');
  }
  if (!Array.isArray(fixture.directories)) {
    fail('missing-directory-manifest');
  }
  if (
    JSON.stringify(tree.directories) !==
    JSON.stringify(
      [...fixture.directories].sort((left, right) => left.path.localeCompare(right.path)),
    )
  ) {
    fail('native-directory-tree-mismatch');
  }

  return {
    files: tree.files.length,
    directories: tree.directories.length,
    retrieveMs,
    verified: true,
    terminalReplay: true,
    codeReplay: true,
    taskExecutions: 0,
    scope:
      'Pinned native HttpRemoteCache consumer; direct retrieval executes no task and does not measure graph/hash scheduling',
  };
}

async function nativeAcceptance(
  worker: BundleWorker,
  fixture: Fixture,
  directory: string,
  lane: NativeLane,
  signal: AbortSignal,
) {
  checkBudget(signal);
  if (lane === RestorationLane.NxRemote) {
    await worker.local.remove(fixture.hash);
  }

  const offset = worker.events.length;
  const start = performance.now();
  await mkdir(directory, { recursive: true });

  const input = join(directory, 'proof-input.json');
  await writeFile(input, JSON.stringify(fixture), { mode: FilePermissions.OwnerOnlyFile });

  const code = `
import { readFile } from 'node:fs/promises';
import { nativeOutputProof } from ${JSON.stringify(import.meta.url)};

try {
  const fixture = JSON.parse(await readFile(process.argv[1], 'utf8'));
  const proof = await nativeOutputProof(fixture, process.argv[2]);
  console.log(JSON.stringify(proof));
} catch {
  console.log(JSON.stringify({ verified: false }));
  process.exitCode = ${ExitCode.Failure};
}
`;

  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', code, input, directory],
    {
      signal,
      killSignal: ProcessSignal.Kill,
      env: {
        ...process.env,
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: worker.url,
        NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: worker.token,
        NX_CACHE_DIRECTORY: directory,
        NX_WORKSPACE_DATA_DIRECTORY: join(directory, 'metadata'),
      },
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );

  let stdout = '';
  let overflow = false;
  let failed = false;
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
    if (stdout.length > NATIVE_PROOF_OUTPUT_LIMIT_BYTES) {
      stdout = '';
      overflow = true;
    }
  });
  child.on('error', () => {
    failed = true;
  });

  const closed: Promise<ExitOutcome> = new Promise((accept) =>
    child.once('close', (code, signal) => accept({ code, signal })),
  );
  try {
    const exit = await closed;
    checkBudget(signal);
    if (failed || overflow || exit.code !== 0 || exit.signal !== null) {
      fail('native-output-proof-failure');
    }

    const proof: unknown = JSON.parse(stdout);
    if (
      typeof proof !== 'object' ||
      proof === null ||
      !('verified' in proof) ||
      proof.verified !== true ||
      !('files' in proof) ||
      typeof proof.files !== 'number' ||
      !Number.isSafeInteger(proof.files) ||
      proof.files < 0 ||
      !('directories' in proof) ||
      typeof proof.directories !== 'number' ||
      !Number.isSafeInteger(proof.directories) ||
      proof.directories < 0 ||
      !('retrieveMs' in proof) ||
      typeof proof.retrieveMs !== 'number' ||
      !Number.isFinite(proof.retrieveMs) ||
      proof.retrieveMs < 0 ||
      !('terminalReplay' in proof) ||
      proof.terminalReplay !== true ||
      !('codeReplay' in proof) ||
      proof.codeReplay !== true ||
      !('taskExecutions' in proof) ||
      proof.taskExecutions !== 0 ||
      !('scope' in proof) ||
      typeof proof.scope !== 'string'
    ) {
      fail('native-output-proof-failure');
    }

    const events = await waitEvents(worker, offset, 1, signal);
    const [event] = events;
    if (
      events.length !== 1 ||
      !event ||
      event.operation !== CacheOperation.Get ||
      event.hash !== fixture.hash ||
      event.tier !== (lane === RestorationLane.NxRemote ? CacheTier.Artifact : CacheTier.Local)
    ) {
      fail('native-tier-mismatch');
    }

    const verifiedProof: NativeProof = {
      files: proof.files,
      directories: proof.directories,
      retrieveMs: proof.retrieveMs,
      verified: true,
      terminalReplay: true,
      codeReplay: true,
      taskExecutions: 0,
      scope: proof.scope,
    };

    return {
      profileId: fixture.profileId,
      lane,
      durationMs: performance.now() - start,
      ...verifiedProof,
    };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(ProcessSignal.Kill);
      await closed;
    }
    if (child.pid && processAlive(child.pid)) {
      fail('native-process-leaked');
    }

    await rm(directory, { recursive: true, force: true });
  }
}

function packageField(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null || !(field in value)) {
    fail('invalid-package-metadata');
  }

  const entries = Object.entries(value);
  const entry = entries.find(([key]) => key === field);
  if (!entry || typeof entry[1] !== 'string') {
    fail('invalid-package-metadata');
  }

  return entry[1];
}

export async function runRestoration(options: ControllerOptions = {}): Promise<ControllerResult> {
  const protocol = options.protocol ?? 'restoration-v1';
  if (!['restoration-v1', 'restoration-perf-v1'].includes(protocol)) {
    fail('invalid-controller-protocol');
  }

  const pairs = options.pairs ?? DEFAULT_MEASURED_PAIRS;
  const population = options.population ?? 0;
  const offline = options.offline ?? false;
  const runId = options.runId ?? randomUUID();
  const jobId = options.jobId ?? 'local';
  if (
    !Number.isSafeInteger(pairs) ||
    pairs < 1 ||
    pairs > MAX_MEASURED_PAIRS ||
    !Number.isSafeInteger(population) ||
    population < 0 ||
    population > MAX_INVENTORY_POPULATION ||
    !identifier.test(runId) ||
    !identifier.test(jobId)
  ) {
    fail('invalid-controller-options');
  }

  const budgetMs = options.budgetMs ?? DEFAULT_RUN_BUDGET_MS;
  if (
    !Number.isSafeInteger(budgetMs) ||
    budgetMs < MIN_RUN_BUDGET_MS ||
    budgetMs > MAX_RUN_BUDGET_MS
  ) {
    fail('invalid-run-budget');
  }

  const signal = AbortSignal.timeout(budgetMs);
  const output = resolve(options.output ?? `.output/restoration-results/${jobId}.json`);
  const region = options.region ?? process.env.NX_ARTIFACT_REGION ?? 'ord';
  if (!/^[a-z0-9-]+$/.test(region)) {
    fail('invalid-storage-region');
  }

  const sdk = packageField(
    JSON.parse(
      await readFile(
        new URL('../../node_modules/@namespacelabs/sdk/package.json', import.meta.url),
        'utf8',
      ),
    ),
    'version',
  );

  const rootParent = process.env.BENCH_ARCHIVE_ROOT ?? tmpdir();
  await mkdir(rootParent, { recursive: true });
  const owned = await mkdtemp(join(rootParent, 'restore-'));
  const workers: Map<Arm, BundleWorker> = new Map();

  const packageManager = packageField(require('../../package.json'), 'packageManager')
    .split('@')
    .at(-1);
  if (!packageManager) {
    fail('invalid-package-metadata');
  }

  const result: ControllerResult = {
    schemaVersion: 1,
    protocol,
    jobId,
    productionRepresentative: false,
    replaySequenceAvailable: false,
    runtime: {
      node: process.versions.node,
      nx: packageField(require('nx/package.json'), 'version'),
      pnpm: packageManager,
      sdk,
      platform: process.platform,
      arch: process.arch,
      runnerProfile:
        process.env.BENCH_RUNNER_PROFILE ?? (offline ? 'offline-local' : 'unspecified'),
      region,
    },
    samples: [],
    failures: [],
    order: [],
    timestamps: { started: new Date().toISOString() },
    acceptance: { samples: [] },
    preparation: {
      budgetMs,
      offline,
      productionRepresentative: false,
      replaySequenceAvailable: false,
      spans: options.traceCandidate
        ? 'Candidate request-scoped inclusive spans are stored separately; overlapping stages must not be summed into wall time. Baseline is untraced.'
        : 'Untraced request totals from cache events; stage attribution is unavailable.',
      memory:
        'Linux adapter-process CPU ticks, RSS, lifetime peak RSS and I/O counters are sampled outside client timing; counter resolution and availability are recorded. Client RSS is a snapshot.',
      populationProfile:
        'Designed size-quantile distribution of synthetic inventory; valid opaque unrelated archives are not Nx extraction fixtures or traffic weights.',
      firstAccessDefinition:
        'First client access per profile/concurrency/lane; remote backend was verified during seeding and is not claimed cold.',
    },
  };

  async function persist() {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  }

  try {
    const baseline = resolve(
      options.baseline ?? '.output/benchmark-baseline/nscloud-nx-cache-action.mjs',
    );
    const candidate = resolve(options.candidate ?? '.output/release/nscloud-nx-cache-action.mjs');
    result.baseline = await bundleMetadata(baseline, options.baselineRevision);
    result.candidate = await bundleMetadata(
      candidate,
      options.candidateRevision ?? process.env.GITHUB_SHA,
    );

    if (process.versions.node !== '24.18.1' || result.runtime.nx !== '23.2.1') {
      fail('unpinned-benchmark-runtime');
    }

    if (process.env.BENCH_MOUNT_EVIDENCE) {
      const mount = JSON.parse(await readFile(process.env.BENCH_MOUNT_EVIDENCE, 'utf8'));
      const runnerEvidence = await verifyMountEvidence(mount, rootParent);
      result.runtime.runnerEvidence = runnerEvidence;
      if (process.env.NSC_CACHE_PATH) {
        try {
          const provider = await lstat(await realpath(process.env.NSC_CACHE_PATH), {
            bigint: true,
          });
          runnerEvidence.providerParentFilesystemDevice = String(provider.dev);
          runnerEvidence.providerParentDeviceAgreement =
            String(provider.dev) === runnerEvidence.filesystemDevice;
        } catch {
          runnerEvidence.providerParentDeviceAvailable = false;
        }
      }
    }

    const corpusFile = resolve(options.corpusFile ?? 'fixtures/restoration/profile.json');
    const corpus = await readCorpus(corpusFile);
    const generated = await generateCorpus({
      directory: join(owned, 'corpus'),
      all: options.all ?? false,
      corpusFile,
      signal,
    });

    checkBudget(signal);
    result.corpusDigest = generated.corpusDigest;
    result.weights = Object.fromEntries(
      corpus.profiles
        .filter((profile) => profile.attempts > 0)
        .map((profile) => [profile.id, profile.attempts]),
    );
    result.calibration = {
      qualified: true,
      selectedProfiles: generated.fixtures.length,
      synthetic: true,
      broaderCensusPending: true,
      profiles: generated.fixtures.map((fixture) => ({
        profileId: fixture.profileId,
        digest: fixture.digest,
        exactLayout: fixture.exactLayout,
        compressedBytes: fixture.calibration.compressedBytes,
        expandedTarBytes: fixture.calibration.expandedTarBytes,
        fileCount: fixture.calibration.fileCount,
        directoryCount: fixture.calibration.directoryCount,
        maxDepth: fixture.calibration.maxDepth,
        outputBytes: fixture.calibration.outputBytes,
        metadataBytes: fixture.calibration.metadataBytes,
        fileSizeBytes: fixture.calibration.fileSizeBytes,
        depthCounts: fixture.calibration.depthCounts,
        directoryChildCounts: fixture.calibration.directoryChildCounts,
      })),
    };

    const fixtures = generated.fixtures.flatMap((fixture) =>
      Array.from({ length: FIXTURE_REPLICAS }, (_value, replica) => ({
        ...fixture,
        hash: sha256(Buffer.from(`restoration-replica-v1:${fixture.hash}:${replica}`)),
        replica,
      })),
    );

    result.order = buildOrder(generated.fixtures, { pairs, offline, seed: `${runId}:${jobId}` });
    result.preparation.orderSeed = `${runId}:${jobId}`;
    await persist();

    const prefix = `nx-cache/benchmark-restoration/${runId}-${jobId}/${result.corpusDigest}`;
    if (!offline) {
      result.preparation.prefix = prefix;

      const seed: Awaited<ReturnType<typeof seedFixtures>> = {
        inventory: [],
        finalizedAndVerified: false,
        expirationHours: SEED_EXPIRATION_HOURS,
      };
      result.preparation.seed = seed;
      await persist();
      result.preparation.seed = await seedFixtures(
        prefix,
        fixtures,
        region,
        async (inventory) => {
          seed.inventory = inventory;
          await persist();
        },
        signal,
      );
      await persist();
    }

    const bundles: [Arm, string][] = [
      [BenchmarkArm.Baseline, baseline],
      [BenchmarkArm.Candidate, candidate],
    ];
    for (const [arm, bundle] of bundles) {
      checkBudget(signal);
      const archive = join(owned, arm, 'archive');
      result.preparation[`${arm}Inventory`] = await populateInventory(archive, population, signal);
      if (offline) {
        await seedLocal(new LocalStore(archive), fixtures);
      }

      const trace = arm === BenchmarkArm.Candidate && (options.traceCandidate ?? false);
      const worker = await startBundleWorker({
        bundle,
        directory: join(owned, arm, 'worker'),
        archive,
        ...(offline ? {} : { prefix }),
        region,
        trace,
        signal,
      });
      workers.set(arm, worker);
      result.preparation[`${arm}SetupMs`] = worker.setupMs;
    }

    for (const plan of result.order) {
      const batch = fixtures
        .filter((fixture) => fixture.profileId === plan.profileId)
        .slice(0, plan.concurrency);
      for (const arm of plan.arms) {
        result.failureContext = {
          stage: 'sample',
          arm,
          profileId: plan.profileId,
          pair: plan.pair,
          concurrency: plan.concurrency,
          lane: plan.lane,
        };
        checkBudget(signal);
        const worker = workers.get(arm);
        if (!worker) {
          fail('missing-arm-worker');
        }
        if (plan.lane === RestorationLane.AdapterRemote) {
          for (const fixture of batch) {
            await worker.local.remove(fixture.hash);
            if (await worker.local.get(fixture.hash)) {
              fail('target-not-client-empty');
            }
          }
        } else {
          await verifyPersisted(worker, batch);
        }

        const eventOffset = worker.events.length;
        const traceOffset = worker.traces.length;
        const adapterBefore = await snapshotProcess(worker.serverPid);
        const cpu = process.cpuUsage();
        const start = performance.now();
        const responses: ResponseProof[] = [];
        const tier =
          plan.lane === RestorationLane.AdapterRemote ? CacheTier.Artifact : CacheTier.Local;

        try {
          const settled = await Promise.allSettled(
            batch.map(async (fixture) => {
              const response = await fetch(`${worker.url}/v1/cache/${fixture.hash}`, {
                headers: { authorization: `Bearer ${worker.token}` },
                signal: AbortSignal.any([
                  signal,
                  AbortSignal.timeout(RESTORATION_REQUEST_TIMEOUT_MS),
                ]),
              });
              const bytes = Buffer.from(await response.arrayBuffer());
              // Full-body digest computation stays inside client timing; gating preserves the failing response.
              const digest = sha256(bytes);
              return { hash: fixture.hash, status: response.status, bytes, digest };
            }),
          );
          const durationMs = performance.now() - start;
          const cpuDelta = process.cpuUsage(cpu);
          for (const outcome of settled) {
            if (outcome.status === 'fulfilled') {
              responses.push(outcome.value);
            }
          }

          if (settled.some((outcome) => outcome.status === 'rejected')) {
            fail('restore-request-failure');
          }

          const events = await waitEvents(worker, eventOffset, batch.length, signal);
          const adapterProcess = processDelta(
            adapterBefore,
            await snapshotProcess(worker.serverPid),
          );

          const proof = assertSampleProof({ responses, fixtures: batch, events, tier });
          await verifyPersisted(worker, batch);

          const traceRequestIds = worker.traces
            .slice(traceOffset)
            .filter((event) => event.stage === 'request.start')
            .map((event) => event.requestId);
          if (
            options.traceCandidate &&
            arm === BenchmarkArm.Candidate &&
            traceRequestIds.length !== batch.length
          ) {
            fail('missing-request-trace');
          }

          result.samples.push({
            jobId,
            pair: plan.pair,
            arm,
            profileId: plan.profileId,
            concurrency: plan.concurrency,
            lane: plan.lane,
            population,
            durationMs,
            serverDurationMs: Math.max(
              ...events
                .filter((event) => event.operation === CacheOperation.Get)
                .map((event) => event.durationMs),
            ),
            clientCpuUserMicros: cpuDelta.user,
            clientCpuSystemMicros: cpuDelta.system,
            clientRssBytes: process.memoryUsage().rss,
            adapterProcess,
            ...(traceRequestIds.length ? { traceRequestIds } : {}),
            valid: true,
            ...(plan.excluded ? { excluded: plan.excluded } : {}),
            ...proof,
          });
        } catch (error) {
          result.failureSample = captureFailureSample({
            responses,
            fixtures: batch,
            events: worker.events.slice(eventOffset),
            tier,
          });
          await persist();
          throw error;
        }

        await persist();
      }
    }

    // Fresh extraction paths per arm/profile/lane; these correctness checks are outside adapter timing.
    for (const [arm, worker] of workers) {
      for (const original of generated.fixtures) {
        const fixture = fixtures.find(
          (value) => value.profileId === original.profileId && value.replica === 0,
        );
        if (!fixture) {
          fail('missing-native-fixture');
        }

        const lanes: NativeLane[] = offline
          ? [RestorationLane.NxLocal]
          : [RestorationLane.NxRemote, RestorationLane.NxLocal];
        for (const lane of lanes) {
          result.failureContext = {
            stage: 'native-acceptance',
            arm,
            profileId: original.profileId,
            lane,
          };
          const acceptance = await nativeAcceptance(
            worker,
            fixture,
            join(owned, 'native', arm, `${original.profileId}-${lane}`),
            lane,
            signal,
          );
          result.acceptance.samples.push({ arm, ...acceptance });
          await persist();
        }
      }
    }

    result.acceptance.verified = true;
    delete result.failureContext;
  } catch (error) {
    result.failures.push(signal.aborted ? 'run-budget-exhausted' : failureCode(error));
  } finally {
    for (const [arm, worker] of workers) {
      const start = performance.now();
      try {
        await worker.close();
        result.preparation[`${arm}CloseMs`] = performance.now() - start;
      } catch (error) {
        result.failures.push(`${arm}:${failureCode(error)}`);
      }
    }

    if (options.traceCandidate) {
      const file = output.replace(/\.json$/, '') + '.trace.json';
      const arms = Object.fromEntries(
        [...workers].map(([arm, worker]) => [
          arm,
          { ...result[arm], traced: arm === BenchmarkArm.Candidate, events: worker.traces },
        ]),
      );

      try {
        await writeFile(
          file,
          JSON.stringify({ schemaVersion: 1, jobId, runtime: result.runtime, arms }),
        );
        result.preparation.trace = {
          candidateEnabled: true,
          file: basename(file),
          scope:
            'Inclusive intervals can overlap; Artifact body consumption includes local consumer backpressure',
        };
      } catch {
        result.failures.push('trace-output-failure');
      }
    }

    try {
      await rm(owned, { recursive: true, force: true });
      result.preparation.ownedCleanupVerified = true;
    } catch {
      result.failures.push('owned-directory-cleanup-failure');
    }

    result.timestamps.finished = new Date().toISOString();
    await persist();
  }

  return result;
}

function parseArguments(args: string[]): ControllerOptions {
  const options: ControllerOptions = {};

  const names: Record<
    string,
    | 'protocol'
    | 'baseline'
    | 'candidate'
    | 'baselineRevision'
    | 'candidateRevision'
    | 'pairs'
    | 'population'
    | 'jobId'
    | 'runId'
    | 'output'
    | 'region'
    | 'corpusFile'
  > = {
    '--protocol': 'protocol',
    '--baseline': BenchmarkArm.Baseline,
    '--candidate': BenchmarkArm.Candidate,
    '--baseline-revision': 'baselineRevision',
    '--candidate-revision': 'candidateRevision',
    '--pairs': 'pairs',
    '--population': 'population',
    '--job-id': 'jobId',
    '--run-id': 'runId',
    '--output': 'output',
    '--region': 'region',
    '--corpus-file': 'corpusFile',
  };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--all') {
      options.all = true;
      continue;
    }
    if (key === '--offline') {
      options.offline = true;
      continue;
    }
    if (key === '--trace-candidate') {
      options.traceCandidate = true;
      continue;
    }
    if (key === undefined) {
      fail('invalid-controller-argument');
    }

    const name = names[key];
    const value = args[index + 1];
    if (!name || !value || value.startsWith('--')) {
      fail('invalid-controller-argument');
    }

    index++;
    if (name === 'pairs' || name === 'population') {
      options[name] = Number(value);
    } else {
      options[name] = value;
    }
  }

  return options;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runRestoration(
      parseArguments(process.argv.slice(NODE_USER_ARGUMENT_OFFSET)),
    );
    const report = {
      jobId: result.jobId,
      samples: result.samples.length,
      failures: result.failures,
      qualification: result.preparation.offline
        ? 'offline-bundle-correctness'
        : 'single-job-awaiting-three-job-analysis',
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = result.failures.length ? ExitCode.Failure : ExitCode.Success;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ failures: [failureCode(error)] })}\n`);
    process.exitCode = ExitCode.Failure;
  }
}
