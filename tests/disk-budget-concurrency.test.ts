import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, mkdir, writeFile, readdir, utimes, access, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DiskBudget } from '../src/disk-budget.js';
import { deferred } from './helpers.js';
import { HOUR_MS } from '../src/units.js';

const FAST_INSPECTION_DELAY_MS = 5;
const SLOW_INSPECTION_DELAY_MS = 20;
const STALE_PARTIAL_TEST_AGE_MS = 2 * HOUR_MS;

async function inventory(count: number): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'nx-budget-concurrency-'));
  for (let index = 0; index < count; index++) {
    const entry = join(directory, String(index).padStart(3, '0'));
    await mkdir(entry);
    await writeFile(join(entry, 'archive'), '1234');
  }

  return directory;
}

test('inventory scanning overlaps bounded entry inspections and accounts for every batch', async (context) => {
  const directory = await inventory(33);
  const original = fs.lstat;
  let active = 0,
    maximum = 0,
    inspected = 0;

  context.mock.method(fs, 'lstat', async (...args: Parameters<typeof fs.lstat>) => {
    const rootEntry = /^\d{3}$/.test(String(args[0]).slice(directory.length + 1));
    if (!rootEntry) {
      return original(...args);
    }

    active++;
    inspected++;
    maximum = Math.max(maximum, active);

    try {
      await delay(FAST_INSPECTION_DELAY_MS);

      return await original(...args);
    } finally {
      active--;
    }
  });
  syncBuiltinESMExports();

  try {
    // 132 stored bytes plus a one-byte reservation requires one eviction.
    const release = await new DiskBudget(directory, 132).reserve(1);
    release();
    assert.equal(inspected, 33);
    assert.equal(maximum, 16);
    assert.equal(active, 0);
    assert.equal((await readdir(directory)).length, 32);
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});

test('equal-age eviction retains directory order despite reversed scan completion', async (context) => {
  const directory = await inventory(33);
  const names = await readdir(directory),
    oldest = names[0];
  assert.ok(oldest);

  const past = new Date(Date.now() - STALE_PARTIAL_TEST_AGE_MS);
  for (const name of names) {
    await utimes(join(directory, name), past, past);
  }

  const original = fs.lstat;
  context.mock.method(fs, 'lstat', async (...args: Parameters<typeof fs.lstat>) => {
    if (String(args[0]) === join(directory, oldest)) {
      await delay(SLOW_INSPECTION_DELAY_MS);
    }

    return original(...args);
  });
  syncBuiltinESMExports();

  try {
    const release = await new DiskBudget(directory, 132).reserve(1);

    release();

    await assert.rejects(access(join(directory, oldest)));
    assert.deepEqual(await readdir(directory), names.slice(1));
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed scan drains pending inspections before releasing the next admission', async (context) => {
  const directory = await inventory(2);

  const original = fs.lstat;
  let failureInjected = false,
    slowStarted = false,
    slowFinished = false,
    firstSettled = false,
    secondEnteredEarly = false;
  const slow = deferred();
  context.mock.method(fs, 'lstat', async (...args: Parameters<typeof fs.lstat>) => {
    if (String(args[0]) === join(directory, '000')) {
      if (!failureInjected) {
        failureInjected = true;

        throw Object.assign(new Error('Controlled failure'), { code: 'EACCES' });
      }

      if (!slowFinished) {
        secondEnteredEarly = true;
      }
    }

    if (String(args[0]) === join(directory, '001') && !slowStarted) {
      slowStarted = true;
      await slow.promise;
      slowFinished = true;
    }

    return original(...args);
  });
  syncBuiltinESMExports();

  try {
    const budget = new DiskBudget(directory, 16);
    const failed = assert.rejects(budget.reserve(1), /Controlled failure/).finally(() => {
      firstSettled = true;
    });
    const next = budget.reserve(1);

    await delay(SLOW_INSPECTION_DELAY_MS);
    assert.equal(slowStarted, true);
    assert.equal(firstSettled, false);
    assert.equal(secondEnteredEarly, false);

    slow.resolve();
    await failed;

    const release = await next;
    release();
    assert.equal(slowFinished, true);
    assert.equal(secondEnteredEarly, false);

    // Failed admission did not leak a reservation.
    const finalRelease = await budget.reserve(8);
    finalRelease();
  } finally {
    slow.resolve();
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});

test('entries disappearing during either enumeration do not leave partial accounting', async (context) => {
  const directory = await inventory(33);
  const original = fs.lstat;
  context.mock.method(fs, 'lstat', async (...args: Parameters<typeof fs.lstat>) => {
    const file = String(args[0]);
    if (file === join(directory, '000')) {
      await rm(file, { recursive: true });
    }

    if (file === join(directory, '001', 'archive')) {
      await rm(file);
    }

    return original(...args);
  });
  syncBuiltinESMExports();

  try {
    // Only 31 complete entries remain. The incomplete one has no accounted bytes.
    const release = await new DiskBudget(directory, 125).reserve(1);
    release();
    assert.equal((await readdir(directory)).length, 32);
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});
