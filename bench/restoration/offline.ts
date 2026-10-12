/**
 * Exercise nineteen storage and lifecycle scenarios across five core cache paths.
 * Deterministic doubles make publication, disk admission, cancellation, corruption
 * and child-status regressions reproducible without Namespace credentials.
 * The recorded timings are diagnostics and do not qualify Namespace performance.
 *
 * Run: pnpm bench:restoration:offline. BENCH_POPULATION controls inventory size.
 * Writes: results/restoration-offline.json; cleans up its temporary resources.
 */

import type { RemoteStore } from '../../src/artifact-store.js';
import type { CacheEvent } from '../../src/metrics.js';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { LocalStore } from '../../src/local-store.js';
import { DiskBudget } from '../../src/disk-budget.js';
import { PublicationQueue } from '../../src/publication-queue.js';
import { startServer } from '../../src/server.js';
import { KIBIBYTE, SECOND_MS } from '../../src/units.js';
import { MAX_INVENTORY_POPULATION } from './benchmark-policy.js';
import { CacheFailureMode } from '../../src/config.js';
import { CacheOperation, CacheTier } from '../../src/metrics.js';
import { HttpMethod, HttpStatus } from '../../src/http.js';
import { PROCESS_EXISTENCE_PROBE, ProcessSignal } from '../../src/process-constants.js';

const OFFLINE_PAYLOAD_BYTES = 8 * KIBIBYTE;
const OFFLINE_REQUEST_TIMEOUT_MS = 5 * SECOND_MS;
const OWNED_COMMAND_TIMEOUT_MS = 10 * SECOND_MS;
const DEFAULT_REPETITIONS = 3;
const MAX_REPETITIONS = 100;
const DEFAULT_INVENTORY_POPULATION = 32;
const INVENTORY_WRITE_CONCURRENCY = 32;
const CONTROLLED_REQUEST_DEADLINE_MS = 120;
const CONTROLLED_QUEUE_DEADLINE_MS = 30;

export const CORE_PATH_SCENARIOS = {
  'local-restoration': ['hit', 'local-miss', 'remote-miss'],
  'publication-drain': [
    'local-put',
    'acceptance-shared-drain',
    'canonical-conflict',
    'bounded-coalescing',
  ],
  'disk-admission': ['saturated-eviction', 'reservation-release', 'inventory-scan'],
  'queue-cancellation': ['request-deadline', 'queue-deadline', 'client-abort', 'overload'],
  'outage-corruption': [
    'local-repair',
    'remote-integrity-rejection',
    CacheFailureMode.FailOpen,
    CacheFailureMode.Strict,
    'command-status',
  ],
};

export type CorePath = keyof typeof CORE_PATH_SCENARIOS;

type Details = Record<string, string | number | boolean>;

export interface CorePathSample {
  path: CorePath;
  scenario: string;
  iteration: number;
  durationMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  rssBytes: number;
  details: Details;
}

export interface CorePathResult {
  version: 1;
  kind: 'offline-core-paths';
  repetitions: number;
  population: number;
  runtime: {
    node: string;
    platform: string;
    arch: string;
    measurement: string;
    qualification: string;
  };
  samples: CorePathSample[];
}

function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function* stream(bytes: Buffer) {
  yield bytes;
}

function payload(size = OFFLINE_PAYLOAD_BYTES): Buffer {
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = (i * 37 + Math.floor(i / 43)) % 256;
  }

  return bytes;
}

function sha(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A fast or wrong-tier response is invalid even when its HTTP status succeeds. */
export function assertRestorationProof(proof: {
  status: number;
  bytes: Uint8Array;
  persisted: Uint8Array;
  expected: Uint8Array;
  events: CacheEvent[];
  tier: 'local' | 'artifact';
  hash: string;
  remoteCalls: number;
}): void {
  assert.equal(proof.status, 200);
  assert.equal(sha(proof.bytes), sha(proof.expected), 'full response digest');
  assert.equal(sha(proof.persisted), sha(proof.expected), 'persisted archive digest');
  assert.equal(
    proof.events.filter(
      (event) =>
        event.hash === proof.hash &&
        event.operation === CacheOperation.Get &&
        event.tier === proof.tier,
    ).length,
    1,
    'exact tier proof',
  );
  if (proof.tier === CacheTier.Local) {
    assert.equal(proof.remoteCalls, 0, 'local GET must not resolve remote');
  }
}

async function owned(work: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'nx-restoration-paths-'));
  try {
    await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

type Server = Awaited<ReturnType<typeof startServer>>;

async function request(server: Server, hash: string, body?: Buffer, signal?: AbortSignal) {
  const response = await fetch(`${server.url}/v1/cache/${hash}`, {
    headers: { authorization: `Bearer ${server.token}` },
    ...(body ? { method: HttpMethod.Put, body: new Uint8Array(body).buffer } : {}),
    signal: signal ?? AbortSignal.timeout(OFFLINE_REQUEST_TIMEOUT_MS),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  await new Promise<void>((resolve) => setImmediate(resolve));

  return { status: response.status, bytes };
}

async function stored(local: LocalStore, hash: string) {
  const file = await local.get(hash);
  assert(file, 'expected valid persisted entry');

  return readFile(file);
}

export function assertCorePathResult(result: CorePathResult): void {
  assert.equal(result.version, 1);
  assert.equal(result.kind, 'offline-core-paths');
  assert(Number.isSafeInteger(result.repetitions) && result.repetitions > 0);
  const expected: string[] = [];
  for (let iteration = 0; iteration < result.repetitions; iteration++) {
    for (const [path, scenarios] of Object.entries(CORE_PATH_SCENARIOS)) {
      for (const scenario of scenarios) {
        expected.push(`${path}/${scenario}/${iteration}`);
      }
    }
  }

  assert.deepEqual(
    result.samples.map((sample) => `${sample.path}/${sample.scenario}/${sample.iteration}`).sort(),
    expected.sort(),
    'every path, scenario and repetition exactly once',
  );
  for (const sample of result.samples) {
    for (const metric of [
      sample.durationMs,
      sample.cpuUserMicros,
      sample.cpuSystemMicros,
      sample.rssBytes,
    ]) {
      assert(Number.isFinite(metric) && metric >= 0, 'finite monotonic measurement');
    }

    assert.equal(sample.details.verified, true, 'correctness proof required');
  }
}

/** Offline smoke timing is not a statistical regression gate or Namespace qualification. */
export async function runCorePaths(
  options: { output?: string; population?: number; repetitions?: number } = {},
): Promise<CorePathResult> {
  const repetitions = options.repetitions ?? DEFAULT_REPETITIONS;
  const population = options.population ?? DEFAULT_INVENTORY_POPULATION;
  assert(
    Number.isSafeInteger(repetitions) && repetitions >= 1 && repetitions <= MAX_REPETITIONS,
    'repetitions must be 1..100',
  );
  assert(
    Number.isSafeInteger(population) && population >= 0 && population <= MAX_INVENTORY_POPULATION,
    `population must be 0..${MAX_INVENTORY_POPULATION}`,
  );

  const samples: CorePathSample[] = [];
  const result: CorePathResult = {
    version: 1,
    kind: 'offline-core-paths',
    repetitions,
    population,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      measurement:
        'Monotonic wall time, parent-process CPU and RSS at completion; setup excluded unless scenario names setup. Subprocess CPU excluded.',
      qualification:
        'Deterministic doubles; offline correctness/smoke timings only. No p95, performance gate, Artifact SDK or NVMe qualification.',
    },
    samples,
  };

  const bytes = payload();

  for (let iteration = 0; iteration < repetitions; iteration++) {
    async function measure(path: CorePath, scenario: string, work: () => Promise<Details>) {
      const cpu = process.cpuUsage();
      const start = performance.now();
      const details = await work();
      const elapsed = process.cpuUsage(cpu);
      samples.push({
        path,
        scenario,
        iteration,
        durationMs: performance.now() - start,
        cpuUserMicros: elapsed.user,
        cpuSystemMicros: elapsed.system,
        rssBytes: process.memoryUsage().rss,
        details: { ...details, verified: true },
      });
    }

    await owned(async (directory) => {
      const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
      await local.receive('hit', stream(bytes));
      let remoteCalls = 0;
      const events: CacheEvent[] = [];
      const server = await startServer({
        local,
        record: (event) => events.push(event),
        remote: {
          async get() {
            remoteCalls++;

            return null;
          },
          async put() {
            throw new Error('unexpected publication');
          },
        },
      });

      try {
        await measure('local-restoration', 'hit', async () => {
          const response = await request(server, 'hit');
          assertRestorationProof({
            ...response,
            persisted: await stored(local, 'hit'),
            expected: bytes,
            events,
            tier: CacheTier.Local,
            hash: 'hit',
            remoteCalls,
          });

          return { bytes: bytes.length, digest: sha(bytes), remoteCalls };
        });
        await measure('local-restoration', 'remote-miss', async () => {
          assert.equal((await request(server, 'missing')).status, 404);
          assert.equal(remoteCalls, 1);
          assert(events.some((event) => event.hash === 'missing' && event.tier === CacheTier.Miss));
          assert.equal(await local.get('missing'), null);

          return { remoteCalls: 1, status: HttpStatus.NotFound };
        });
      } finally {
        await server.close();
      }

      const offline = await startServer({ local, record: () => {} });

      try {
        await measure('local-restoration', 'local-miss', async () => {
          assert.equal((await request(offline, 'missing')).status, 404);

          return { remoteCalls: 0, status: HttpStatus.NotFound };
        });
        await measure('publication-drain', 'local-put', async () => {
          assert.equal((await request(offline, 'new', bytes)).status, 200);
          assert.equal(sha(await stored(local, 'new')), sha(bytes));

          return { bytes: bytes.length, digest: sha(bytes) };
        });
      } finally {
        await offline.close();
      }
    });

    await owned(async (directory) => {
      const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
      const entered = gate();
      const publication = gate();
      let published = false;
      let publishedDigest = '';
      const server = await startServer({
        local,
        backgroundPublication: true,
        record: () => {},
        remote: {
          async get() {
            return null;
          },
          async put(_hash, file) {
            entered.release();
            await publication.promise;
            publishedDigest = sha(await readFile(file));
            published = true;

            return true;
          },
        },
      });

      try {
        await measure('publication-drain', 'acceptance-shared-drain', async () => {
          const start = performance.now();
          assert.equal((await request(server, 'publish', bytes)).status, 200);
          const acceptanceMs = performance.now() - start;
          await entered.promise;
          assert.equal(published, false, 'local acceptance precedes remote publication');
          assert.equal(sha(await stored(local, 'publish')), sha(bytes));

          let drained = false;
          const drain = server.drain().then(() => {
            drained = true;
          });
          await new Promise<void>((resolve) => setImmediate(resolve));
          assert.equal(drained, false);

          const drainStart = performance.now();
          publication.release();
          await drain;
          assert.equal(published, true);
          assert.equal(publishedDigest, sha(bytes));

          return { acceptanceMs, releasedDrainMs: performance.now() - drainStart, publishedDigest };
        });
      } finally {
        publication.release();
        await server.close();
      }

      const winner = payload(4096);
      const conflict = await startServer({
        local,
        record: () => {},
        remote: {
          async get() {
            return stream(winner);
          },
          async put() {
            return false;
          },
        },
      });

      try {
        await measure('publication-drain', 'canonical-conflict', async () => {
          assert.equal((await request(conflict, 'conflict', bytes)).status, 409);
          assert.equal(sha((await request(conflict, 'conflict')).bytes), sha(winner));
          assert.equal(sha(await stored(local, 'conflict')), sha(winner));

          return { canonicalDigest: sha(winner), loserDigest: sha(bytes) };
        });
      } finally {
        await conflict.close();
      }
    });
    await measure('publication-drain', 'bounded-coalescing', async () => {
      const queue = new PublicationQueue();
      const hold = gate();
      let active = 0;
      let peak = 0;
      let completed = 0;
      const publish = async () => {
        active++;
        peak = Math.max(active, peak);
        await hold.promise;
        active--;
        completed++;
      };

      try {
        await queue.add('same', publish);
        await queue.add('same', publish);
        for (let index = 1; index < 10; index++) {
          await queue.add(`distinct-${index}`, publish);
        }

        let accepted = false;
        const third = queue.add('third', publish).then(() => {
          accepted = true;
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(accepted, false);

        hold.release();
        await third;
        await queue.drain();
        assert.equal(peak, 10);
        assert.equal(completed, 11);

        return {
          peakPublications: peak,
          distinctPublications: completed,
          duplicatePublications: 0,
        };
      } finally {
        hold.release();
        await queue.drain();
      }
    });

    await owned(async (directory) => {
      const small = payload(KIBIBYTE);
      const local = new LocalStore(directory, { maxArchiveBytes: KIBIBYTE, maxDiskBytes: 6144 });
      await local.receive('old', stream(small));
      await utimes(join(local.directory, 'old'), new Date(1), new Date(1));
      await writeFile(join(local.directory, 'unrelated.txt'), 'retained');

      await measure('disk-admission', 'saturated-eviction', async () => {
        await local.receive('next', stream(small));
        assert.equal(await local.get('old'), null);
        assert.equal(sha(await stored(local, 'next')), sha(small));
        assert.equal(await readFile(join(local.directory, 'unrelated.txt'), 'utf8'), 'retained');
        assert.equal(
          (await readdir(local.directory)).some((name) => name.startsWith('.tmp-')),
          false,
        );

        return { maxDiskBytes: 6144, admittedBytes: small.length, evictedEntries: 1 };
      });

      await measure('disk-admission', 'reservation-release', async () => {
        const budget = new DiskBudget(join(directory, 'reservation'), 8192);
        const release = await budget.reserve(8192);
        await assert.rejects(budget.reserve(1), /exhausted/);

        release();
        release();

        const next = await budget.reserve(8192);
        next();

        await assert.rejects(
          local.receive(
            'failed',
            (async function* () {
              yield payload(KIBIBYTE);
              throw new Error('controlled broken upload');
            })(),
          ),
          /broken upload/,
        );

        await local.receive('after-failure', stream(payload(KIBIBYTE)));
        assert.equal(sha(await stored(local, 'after-failure')), sha(payload(KIBIBYTE)));
        assert.equal(
          (await readdir(local.directory)).some((name) => name.startsWith('.tmp-')),
          false,
        );

        return { simultaneousReservationRejected: true, subsequentReservationAdmitted: true };
      });
    });
    await owned(async (directory) => {
      // Populate valid metadata directly outside timing; admission itself would make setup quadratic.
      const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
      await mkdir(local.directory, { recursive: true });
      const small = payload(256);
      const metadata = JSON.stringify({
        version: 1,
        bytes: small.length,
        digest: sha(small),
        createdAt: Date.now(),
      });
      for (let offset = 0; offset < population; offset += INVENTORY_WRITE_CONCURRENCY) {
        await Promise.all(
          Array.from(
            { length: Math.min(INVENTORY_WRITE_CONCURRENCY, population - offset) },
            async (_value, index) => {
              const entry = join(local.directory, `inventory-${offset + index}`);
              await mkdir(entry);
              await writeFile(join(entry, 'archive'), small);
              await writeFile(join(entry, 'metadata.json'), metadata);
            },
          ),
        );
      }

      await measure('disk-admission', 'inventory-scan', async () => {
        await local.receive('target', stream(bytes));
        assert.equal(sha(await stored(local, 'target')), sha(bytes));
        assert.equal((await readdir(local.directory)).length, population + 1);
        if (population) {
          assert.equal(sha(await stored(local, 'inventory-0')), sha(small));
        }

        return { unrelatedEntries: population, newEntries: 1, archiveBytes: bytes.length };
      });
    });

    for (const scenario of CORE_PATH_SCENARIOS['queue-cancellation']) {
      await owned(async (directory) => {
        const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
        await local.receive('healthy', stream(bytes));

        const entered = gate();
        const events: CacheEvent[] = [];
        const remote: RemoteStore = {
          async get(_hash, signal) {
            entered.release();
            assert(signal);

            return new Promise((_resolve, reject) => {
              if (signal.aborted) {
                reject(signal.reason);
              } else {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
              }
            });
          },
          async put() {
            throw new Error('unexpected publication');
          },
        };
        const server = await startServer({
          local,
          remote,
          record: (event) => events.push(event),
          maxConcurrentRequests: 1,
          maxQueuedRequests: scenario === 'overload' ? 0 : 1,
          requestDeadlineMs: CONTROLLED_REQUEST_DEADLINE_MS,
          queueWaitMs: CONTROLLED_QUEUE_DEADLINE_MS,
        });

        try {
          await measure('queue-cancellation', scenario, async () => {
            const controller = new AbortController();
            const blocked = request(server, 'blocked', undefined, controller.signal).then(
              (value) => value,
              (error) => {
                assert(error instanceof Error && error.name === 'AbortError');

                return null;
              },
            );
            await entered.promise;
            let status = 0;
            if (scenario === 'client-abort') {
              controller.abort();
              assert.equal(await blocked, null);
            } else {
              if (scenario === 'overload' || scenario === 'queue-deadline') {
                status = (await request(server, 'queued')).status;
                assert.equal(status, 503);
                assert(
                  events.some(
                    (event) => event.hash === 'queued' && event.tier === CacheTier.Overload,
                  ),
                );
              }

              assert.equal((await blocked)?.status, 503);
            }

            const healthy = await request(server, 'healthy');
            assert.equal(healthy.status, 200);
            assert.equal(sha(healthy.bytes), sha(bytes));

            return {
              failedStatus:
                status || (scenario === 'client-abort' ? 0 : HttpStatus.ServiceUnavailable),
              nextHealthyStatus: 200,
            };
          });
        } finally {
          await server.close();
        }
      });
    }

    await owned(async (directory) => {
      const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
      const corrupt = await local.receive('repair', stream(bytes));
      const poisoned = Buffer.from(bytes);
      poisoned[0] = 255;
      await writeFile(corrupt.file, poisoned);

      const events: CacheEvent[] = [];
      let calls = 0;
      const server = await startServer({
        local,
        record: (event) => events.push(event),
        remote: {
          async get() {
            calls++;

            return stream(bytes);
          },
          async put() {
            throw new Error('unexpected publication');
          },
        },
      });

      try {
        await measure('outage-corruption', 'local-repair', async () => {
          const response = await request(server, 'repair');
          assertRestorationProof({
            ...response,
            expected: bytes,
            persisted: await stored(local, 'repair'),
            events,
            tier: CacheTier.Artifact,
            hash: 'repair',
            remoteCalls: calls,
          });
          assert.equal(calls, 1);
          assert(events.some((event) => event.tier === CacheTier.Corrupt));

          return { artifactCalls: calls, corruptEntriesRepaired: 1 };
        });
      } finally {
        await server.close();
      }

      const broken = await startServer({
        local,
        failOpen: true,
        record: () => {},
        remote: {
          async get() {
            return (async function* () {
              yield bytes.subarray(0, 100);
              throw new Error('Artifact integrity mismatch');
            })();
          },
          async put() {
            throw new Error('unexpected publication');
          },
        },
      });

      try {
        await measure('outage-corruption', 'remote-integrity-rejection', async () => {
          const response = await request(broken, 'broken');
          assert.equal(response.status, 404);
          assert.equal(response.bytes.length, 0);
          assert.equal(await local.get('broken'), null);
          assert.equal(
            (await readdir(local.directory)).some((name) => name.startsWith('.tmp-')),
            false,
          );

          return {
            servedBytes: 0,
            persisted: false,
            boundary:
              'RemoteStore stream rejects integrity at EOF; provider digest check is not exercised',
          };
        });
      } finally {
        await broken.close();
      }
    });
    for (const failOpen of [true, false]) {
      await owned(async (directory) => {
        const local = new LocalStore(directory, { maxArchiveBytes: bytes.length });
        await local.receive('healthy', stream(bytes));
        const server = await startServer({
          local,
          failOpen,
          record: () => {},
          remote: {
            async get() {
              throw new Error('controlled outage');
            },
            async put() {
              throw new Error('controlled outage');
            },
          },
        });

        try {
          await measure(
            'outage-corruption',
            failOpen ? CacheFailureMode.FailOpen : CacheFailureMode.Strict,
            async () => {
              assert.equal(sha((await request(server, 'healthy')).bytes), sha(bytes));
              assert.equal((await request(server, 'missing')).status, failOpen ? 404 : 500);
              assert.equal((await request(server, 'write', bytes)).status, failOpen ? 200 : 500);
              if (failOpen) {
                assert.equal(sha(await stored(local, 'write')), sha(bytes));
              } else {
                assert.equal(await local.get('write'), null);
              }

              assert.equal(sha(await stored(local, 'healthy')), sha(bytes));

              return {
                failOpen,
                existingLocalPreserved: true,
                failedPublicationRetainedLocally: failOpen,
              };
            },
          );
        } finally {
          await server.close();
        }
      });
    }

    await measure('outage-corruption', 'command-status', async () => {
      // Signal handlers and actual child execution live in a separate owned process.
      const commandModule = new URL('../../src/cache-command.ts', import.meta.url).href;
      const code = `
import { runCachedCommand } from ${JSON.stringify(commandModule)};

let closes = 0;
const server = {
  url: 'http://127.0.0.1',
  token: 'synthetic',
  async close() {
    closes++;
    throw new Error('controlled publication failure');
  },
};

const statuses = [];
statuses.push(await runCachedCommand(
  server, process.execPath, ['-e', 'process.exit(7)'], process.env,
));
statuses.push(await runCachedCommand(
  server, process.execPath, ['-e', 'process.exit(0)'], process.env,
));
statuses.push(await runCachedCommand(
  server, process.execPath, ['-e', 'process.exit(0)'], process.env,
  { strictPublication: false },
));

console.log(JSON.stringify({ statuses, closes }));
`;

      const child = spawn(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', code],
        { stdio: ['ignore', 'pipe', 'pipe'], timeout: OWNED_COMMAND_TIMEOUT_MS },
      );

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          child.once('error', reject);
          child.once('close', (code, signal) => resolve({ code, signal }));
        },
      );
      try {
        const exit = await exited;
        assert.equal(exit.signal, null);
        assert.equal(exit.code, 0, stderr);

        const evidence: unknown = JSON.parse(stdout);
        assert.deepEqual(evidence, { statuses: [7, 1, 0], closes: 3 });

        if (child.pid) {
          assert.throws(() => process.kill(child.pid ?? 0, PROCESS_EXISTENCE_PROBE));
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill(ProcessSignal.Kill);
          await exited;
        }
      }

      return {
        failedChildStatus: 7,
        strictSuccessfulChildStatus: 1,
        failOpenSuccessfulChildStatus: 0,
        wrapperCloseCount: 3,
      };
    });
  }

  assertCorePathResult(result);
  if (options.output) {
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`);
    assert((await stat(options.output)).size > 0);
  }

  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await runCorePaths({
    output: 'results/restoration-offline.json',
    population: process.env.BENCH_POPULATION ? Number(process.env.BENCH_POPULATION) : 32,
  });
  console.log(
    JSON.stringify({
      paths: 5,
      scenarios: new Set(result.samples.map((sample) => sample.scenario)).size,
      samples: result.samples.length,
      output: 'results/restoration-offline.json',
    }),
  );
}
