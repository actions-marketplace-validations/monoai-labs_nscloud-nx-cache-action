import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertCorePathResult,
  assertRestorationProof,
  CORE_PATH_SCENARIOS,
  runCorePaths,
} from '../bench/restoration/offline.js';
import type { CacheEvent } from '../src/metrics.js';
import { CacheOperation, CacheTier } from '../src/metrics.js';
import { HttpStatus } from '../src/http.js';
import { MINUTE_MS } from '../src/units.js';

const CORE_PATH_TEST_TIMEOUT_MS = MINUTE_MS;

test(
  'five core paths collect every scenario with complete correctness and resource evidence',
  { timeout: CORE_PATH_TEST_TIMEOUT_MS },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nx-core-path-result-'));

    try {
      const output = join(directory, 'result.json');
      const result = await runCorePaths({ population: 4, repetitions: 1, output });
      assert.equal(Object.keys(CORE_PATH_SCENARIOS).length, 5);
      assertCorePathResult(result);
      assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), result);
      assert.match(result.runtime.qualification, /No p95/);

      const inventory = result.samples.find((sample) => sample.scenario === 'inventory-scan');
      assert.equal(inventory?.details.unrelatedEntries, 4);

      const publication = result.samples.find(
        (sample) => sample.scenario === 'acceptance-shared-drain',
      );
      assert.equal(typeof publication?.details.acceptanceMs, 'number');
      assert.equal(typeof publication?.details.releasedDrainMs, 'number');

      assert.throws(
        () => assertCorePathResult({ ...result, samples: result.samples.slice(1) }),
        /exactly once/,
      );
      assert.throws(
        () => assertCorePathResult({ ...result, samples: [...result.samples, ...result.samples] }),
        /exactly once/,
      );

      const first = result.samples[0];
      assert(first);
      assert.throws(
        () =>
          assertCorePathResult({
            ...result,
            samples: [{ ...first, durationMs: NaN }, ...result.samples.slice(1)],
          }),
        /monotonic/,
      );
      assert.throws(
        () =>
          assertCorePathResult({
            ...result,
            samples: [{ ...first, details: { verified: false } }, ...result.samples.slice(1)],
          }),
        /correctness proof/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('response proof rejects wrong bytes, persisted poison, wrong tier and unexpected remote work', () => {
  const expected = Buffer.from('expected archive');
  const events: CacheEvent[] = [
    {
      hash: 'test',
      operation: CacheOperation.Get,
      tier: CacheTier.Local,
      durationMs: 1,
      bytes: expected.length,
    },
  ];
  const valid = {
    status: HttpStatus.Ok,
    bytes: expected,
    expected,
    persisted: expected,
    events,
    tier: CacheTier.Local,
    hash: 'test',
    remoteCalls: 0,
  };

  // Keep the literal tier narrow without type assertions.
  assertRestorationProof({ ...valid, tier: CacheTier.Local });

  assert.throws(
    () => assertRestorationProof({ ...valid, tier: CacheTier.Local, bytes: expected.subarray(1) }),
    /response digest/,
  );
  assert.throws(
    () =>
      assertRestorationProof({ ...valid, tier: CacheTier.Local, persisted: Buffer.from('poison') }),
    /persisted archive/,
  );
  assert.throws(() => assertRestorationProof({ ...valid, tier: CacheTier.Artifact }), /tier proof/);
  assert.throws(
    () => assertRestorationProof({ ...valid, tier: CacheTier.Local, remoteCalls: 1 }),
    /must not resolve remote/,
  );
});

test('core path parameter bounds reject invalid runs before creating resources', async () => {
  await assert.rejects(runCorePaths({ repetitions: 0 }), /repetitions/);

  await assert.rejects(runCorePaths({ population: -1 }), /population/);
  await assert.rejects(runCorePaths({ population: 16584 }), /population/);
});
