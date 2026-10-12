import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile, utimes, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiskBudget } from '../src/disk-budget.js';
import { configuration } from '../src/config.js';
import { KIBIBYTE, MEBIBYTE, HOUR_MS } from '../src/units.js';

const STALE_PARTIAL_TEST_AGE_MS = 2 * HOUR_MS;

test('disk admission evicts old archives but preserves unknown paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-budget-'));

  try {
    await mkdir(join(directory, 'first'));
    await writeFile(join(directory, 'first', 'archive'), '12345678');
    await writeFile(join(directory, 'unrelated.txt'), 'keep');

    const reserve = await new DiskBudget(directory, 10).reserve(8);

    await assert.rejects(access(join(directory, 'first')));

    await access(join(directory, 'unrelated.txt'));
    reserve();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('concurrent reservations cannot oversubscribe the budget and release is idempotent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-budget-'));

  try {
    const budget = new DiskBudget(directory, 10);
    const release = await budget.reserve(8);

    await assert.rejects(budget.reserve(8), /budget exhausted/);

    release();
    release();

    const next = await budget.reserve(8);

    await assert.rejects(budget.reserve(8), /budget exhausted/);

    next();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('only stale connector partials are removed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-budget-'));

  try {
    for (const name of ['.tmp-old-abc', '.tmp-active-abc']) {
      await mkdir(join(directory, name));
    }

    const past = new Date(Date.now() - STALE_PARTIAL_TEST_AGE_MS);
    await utimes(join(directory, '.tmp-old-abc'), past, past);

    const release = await new DiskBudget(directory, 10).reserve(1);
    release();

    await assert.rejects(access(join(directory, '.tmp-old-abc')));

    await access(join(directory, '.tmp-active-abc'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('configuration reserves extraction capacity and validates limits', () => {
  const config = configuration({ NX_ARCHIVE_DIRECTORY: '/tmp/cache' });
  assert.equal(config.maxDiskBytes + config.extractionBytes, 10 * 1024 ** 3);
  assert.equal(config.strict, false);
  assert.throws(() =>
    configuration({ NX_ARCHIVE_DIRECTORY: '/tmp/cache', NX_CACHE_DISK_BYTES: '1' }),
  );
  assert.throws(() =>
    configuration({ NX_ARCHIVE_DIRECTORY: '/tmp/cache', NX_CACHE_ACCESS: 'anything' }),
  );
});

test('archive admission tolerates concurrent atomic publication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-admission-race-'));

  try {
    const { LocalStore } = await import('../src/local-store.js');
    const store = new LocalStore(directory, { maxArchiveBytes: KIBIBYTE, maxDiskBytes: MEBIBYTE });
    const results = await Promise.allSettled(
      Array.from({ length: 80 }, (_, i) =>
        store.receive(
          String(i),
          (async function* () {
            yield Buffer.alloc(128, i);
          })(),
        ),
      ),
    );
    const failures = results.filter((result) => result.status === 'rejected');
    assert.deepEqual(failures, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
