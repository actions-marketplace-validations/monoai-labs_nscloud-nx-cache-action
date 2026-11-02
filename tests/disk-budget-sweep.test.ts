import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DiskBudget, INVENTORY_FILE } from '../src/disk-budget.js';
import { DAY_MS, HOUR_MS } from '../src/units.js';
import { archiveNames, deferred } from './helpers.js';

const BUDGET = 1000;
const ENTRY_BYTES = 4;
const RETENTION_MS = 7 * DAY_MS;
const SCAN_CONCURRENCY = 16;
const REMOVAL_DELAY_MS = 5;

interface Scans {
  /** Archive entries inspected by every scan so far. */
  inspected: number;
}

/** Entries 000, 001, ... of four bytes each, oldest first. */
async function populate(count: number): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'nx-sweep-'));
  const now = Date.now();
  for (let index = 0; index < count; index++) {
    const entry = join(directory, String(index).padStart(3, '0'));
    await mkdir(entry);
    await writeFile(join(entry, 'archive'), '1234');

    const modified = new Date(now - (count - index) * 1000);
    await utimes(entry, modified, modified);
  }

  return directory;
}

function trackScans(
  context: TestContext,
  directory: string,
  onInspect: (inspected: number) => Promise<void> = async () => {},
): Scans {
  const original = fs.lstat;
  const scans: Scans = { inspected: 0 };
  context.mock.method(fs, 'lstat', async (...args: Parameters<typeof fs.lstat>) => {
    const target = String(args[0]);
    if (dirname(target) === directory && /^\d{3}$/.test(basename(target))) {
      scans.inspected++;
      await onInspect(scans.inspected);
    }

    return original(...args);
  });
  syncBuiltinESMExports();

  return scans;
}

async function scenario(
  context: TestContext,
  count: number,
  run: (directory: string, scans: Scans) => Promise<void>,
  onInspect?: (inspected: number) => Promise<void>,
) {
  const directory = await populate(count);
  const scans = trackScans(context, directory, onInspect);

  try {
    await run(directory, scans);
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
}

function inventoryPath(directory: string): string {
  return join(directory, INVENTORY_FILE);
}

async function readInventory(directory: string) {
  return JSON.parse(await readFile(inventoryPath(directory), 'utf8'));
}

async function seedInventory(directory: string, fields: Record<string, unknown>) {
  await writeFile(
    inventoryPath(directory),
    JSON.stringify({ version: 1, scannedAt: Date.now(), bytes: 0, ...fields }),
  );
}

async function expire(directory: string, names: string[]) {
  const past = new Date(Date.now() - RETENTION_MS - DAY_MS);
  for (const name of names) {
    await utimes(join(directory, name), past, past);
  }
}

function mockAvailableBytes(context: TestContext, available: (call: number) => number) {
  const calls = { count: 0 };
  context.mock.method(fs, 'statfs', async () => {
    calls.count++;

    return {
      type: 0,
      bsize: 1,
      blocks: 0,
      bfree: 0,
      bavail: available(calls.count),
      files: 0,
      ffree: 0,
    };
  });
  syncBuiltinESMExports();

  return calls;
}

test('reservations inside the sweep interval do not scan, including from another process', (context) =>
  scenario(context, 3, async (directory, scans) => {
    const budget = new DiskBudget(directory, BUDGET);
    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 3);

    const recorded = await readInventory(directory);
    assert.equal(recorded.version, 1);
    assert.equal(recorded.bytes, 3 * ENTRY_BYTES);

    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 3);

    await (
      await new DiskBudget(directory, BUDGET).reserve(10)
    )();
    assert.equal(scans.inspected, 3);
    assert.deepEqual(await readInventory(directory), recorded);
  }));

const UNUSABLE_INVENTORIES: [string, () => string][] = [
  ['stale', () => JSON.stringify({ version: 1, scannedAt: Date.now() - 2 * HOUR_MS, bytes: 0 })],
  ['future-dated', () => JSON.stringify({ version: 1, scannedAt: Date.now() + HOUR_MS, bytes: 0 })],
  ['malformed', () => '{"version": 1, "scannedAt"'],
  ['wrong-version', () => JSON.stringify({ version: 2, scannedAt: Date.now(), bytes: 0 })],
  ['negative-bytes', () => JSON.stringify({ version: 1, scannedAt: Date.now(), bytes: -1 })],
  ['non-numeric', () => JSON.stringify({ version: 1, scannedAt: 'now', bytes: 0 })],
  [
    'oversized',
    () => JSON.stringify({ version: 1, scannedAt: Date.now(), bytes: 0, pad: 'x'.repeat(4096) }),
  ],
];

for (const [name, contents] of UNUSABLE_INVENTORIES) {
  test(`${name} sidecar forces a scan and is rewritten`, (context) =>
    scenario(context, 3, async (directory, scans) => {
      await writeFile(inventoryPath(directory), contents());

      const before = Date.now();
      await (
        await new DiskBudget(directory, BUDGET).reserve(10)
      )();
      const after = Date.now();

      assert.equal(scans.inspected, 3);

      const recorded = await readInventory(directory);
      assert.equal(recorded.version, 1);
      assert.equal(recorded.bytes, 3 * ENTRY_BYTES);
      assert(recorded.scannedAt >= before && recorded.scannedAt <= after);
      assert.deepEqual(Object.keys(recorded).sort(), ['bytes', 'scannedAt', 'version']);
    }));
}

test('a symlinked sidecar is not followed, forces a scan and is replaced', (context) =>
  scenario(context, 3, async (directory, scans) => {
    const target = join(directory, 'elsewhere.json');
    const claim = JSON.stringify({ version: 1, scannedAt: Date.now(), bytes: 0 });
    await writeFile(target, claim);
    await symlink(target, inventoryPath(directory));

    await (
      await new DiskBudget(directory, BUDGET).reserve(10)
    )();

    assert.equal(scans.inspected, 3);
    assert.equal((await lstat(inventoryPath(directory))).isSymbolicLink(), false);
    assert.equal((await readInventory(directory)).bytes, 3 * ENTRY_BYTES);
    assert.equal(await readFile(target, 'utf8'), claim);
  }));

test(
  'the sidecar is owner-only and leaves no temporary file',
  { skip: process.platform === 'win32' },
  (context) =>
    scenario(context, 1, async (directory) => {
      await (
        await new DiskBudget(directory, BUDGET).reserve(10)
      )(10);

      assert.equal((await stat(inventoryPath(directory))).mode & 0o777, 0o600);
      assert.deepEqual(
        (await readdir(directory)).filter((name) => name.startsWith('.tmp-')),
        [],
      );
    }),
);

test('a sidecar near the budget forces a scan, and eviction records the exact total', (context) =>
  scenario(context, 5, async (directory, scans) => {
    await seedInventory(directory, { bytes: 19 });

    // 20 stored bytes plus the 5 reserved bytes need the two oldest entries evicted.
    await (
      await new DiskBudget(directory, 20).reserve(5)
    )();

    assert.equal(scans.inspected, 5);
    assert.deepEqual(await archiveNames(directory), ['002', '003', '004']);
    assert.equal((await readInventory(directory)).bytes, 3 * ENTRY_BYTES);
  }));

test('a low sidecar total delays eviction until the next sweep and never refuses a write', (context) =>
  scenario(context, 5, async (directory, scans) => {
    await seedInventory(directory, { bytes: 0 });

    const budget = new DiskBudget(directory, 20);
    await (
      await budget.reserve(5)
    )();

    assert.equal(scans.inspected, 0);
    assert.equal((await archiveNames(directory)).length, 5);

    await seedInventory(directory, { bytes: 0, scannedAt: Date.now() - 2 * HOUR_MS });
    await (
      await budget.reserve(5)
    )();

    assert.equal(scans.inspected, 5);
    assert.deepEqual(await archiveNames(directory), ['002', '003', '004']);
  }));

test('real budget pressure gets an exact scan before the write is refused', (context) =>
  scenario(context, 3, async (directory, scans) => {
    const budget = new DiskBudget(directory, 12);
    const held = await budget.reserve(4);
    assert.equal(scans.inspected, 3);
    assert.deepEqual(await archiveNames(directory), ['001', '002']);

    await assert.rejects(budget.reserve(9), /Cache disk budget exhausted/);
    assert.equal(scans.inspected, 5);
    assert.deepEqual(await archiveNames(directory), []);
    assert.equal((await readInventory(directory)).bytes, 0);

    await held();
    await (
      await budget.reserve(9)
    )();
  }));

test('publications accumulate in the sidecar across sequential processes until the estimate crosses the budget', (context) =>
  scenario(context, 1, async (directory, scans) => {
    const budget = 40;
    let stored = ENTRY_BYTES;
    let scannedAt: number | undefined;

    for (let round = 0; round < 3; round++) {
      const release = await new DiskBudget(directory, budget).reserve(10);
      assert.equal(scans.inspected, 1);

      await release(10);
      stored += 10;

      const recorded = await readInventory(directory);
      assert.equal(recorded.bytes, stored);
      scannedAt ??= recorded.scannedAt;
      assert.equal(recorded.scannedAt, scannedAt);
    }

    // 34 recorded bytes plus 10 reserved exceed the 40-byte budget.
    await (
      await new DiskBudget(directory, budget).reserve(10)
    )();
    assert.equal(scans.inspected, 2);
    assert.equal((await readInventory(directory)).bytes, ENTRY_BYTES);
  }));

test('only a positive published byte count is recorded, and only once', (context) =>
  scenario(context, 1, async (directory) => {
    const budget = new DiskBudget(directory, BUDGET);
    const recorded = async () => (await readInventory(directory)).bytes;

    await (
      await budget.reserve(10)
    )();
    assert.equal(await recorded(), ENTRY_BYTES);

    for (const ignored of [undefined, 0, -5, 1.5, Number.NaN]) {
      await (
        await budget.reserve(10)
      )(ignored);
      assert.equal(await recorded(), ENTRY_BYTES);
    }

    const release = await budget.reserve(10);
    await release(7);
    await release(7);
    assert.equal(await recorded(), ENTRY_BYTES + 7);
  }));

test('publication does not create or repair a missing or unusable sidecar', (context) =>
  scenario(context, 1, async (directory) => {
    const budget = new DiskBudget(directory, BUDGET);
    const missing = await budget.reserve(10);
    await rm(inventoryPath(directory));
    await missing(10);

    await assert.rejects(access(inventoryPath(directory)));

    const damaged = '{"version": 1';
    const unusable = await budget.reserve(10);
    await writeFile(inventoryPath(directory), damaged);
    await unusable(10);

    assert.equal(await readFile(inventoryPath(directory), 'utf8'), damaged);
  }));

test('concurrent publications in one process are all recorded', (context) =>
  scenario(context, 1, async (directory) => {
    const budget = new DiskBudget(directory, BUDGET);
    const releases = await Promise.all(Array.from({ length: 8 }, () => budget.reserve(10)));
    const { scannedAt } = await readInventory(directory);

    await Promise.all(releases.map((release) => release(100)));

    const recorded = await readInventory(directory);
    assert.equal(recorded.bytes, ENTRY_BYTES + 8 * 100);
    assert.equal(recorded.scannedAt, scannedAt);
  }));

test('a publication finishing during a scan is carried into the recorded total', (context) => {
  const reached = deferred();
  const gate = deferred();

  return scenario(
    context,
    1,
    async (directory, scans) => {
      const budget = new DiskBudget(directory, 100);
      const held = await budget.reserve(30);
      assert.equal(scans.inspected, 1);

      // 4 recorded + 30 held + 80 requested exceeds the budget and scans again.
      const pressured = budget.reserve(80);
      await reached.promise;

      await held(25);
      assert.equal((await readInventory(directory)).bytes, ENTRY_BYTES + 25);

      gate.resolve();
      await (
        await pressured
      )();

      assert.equal(scans.inspected, 2);
      assert.equal((await readInventory(directory)).bytes, ENTRY_BYTES + 25);
    },
    async (inspected) => {
      if (inspected === 2) {
        reached.resolve();
        await gate.promise;
      }
    },
  ).finally(() => gate.resolve());
});

test('a sweep removes entries untouched past the retention and does not count them', (context) =>
  scenario(context, 4, async (directory, scans) => {
    await mkdir(join(directory, 'not an entry'));
    await mkdir(join(directory, '.tmp-fresh-partial'));
    await writeFile(join(directory, 'unrelated.txt'), 'keep');
    await writeFile(inventoryPath(directory), '{}');
    await expire(directory, ['000', '001', 'not an entry', 'unrelated.txt', INVENTORY_FILE]);

    const budget = new DiskBudget(directory, BUDGET, { maxAgeMs: RETENTION_MS });
    await (
      await budget.reserve(10)
    )();

    assert.equal(scans.inspected, 4);
    assert.deepEqual((await readdir(directory)).sort(), [
      INVENTORY_FILE,
      '.tmp-fresh-partial',
      '002',
      '003',
      'not an entry',
      'unrelated.txt',
    ]);
    assert.equal((await readInventory(directory)).bytes, 2 * ENTRY_BYTES);
  }));

test('expiry removals run at the scan concurrency', (context) =>
  scenario(context, 40, async (directory, scans) => {
    await expire(
      directory,
      Array.from({ length: 40 }, (_, index) => String(index).padStart(3, '0')),
    );

    const original = fs.rm;
    let active = 0,
      maximum = 0,
      removed = 0;
    context.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
      const target = String(args[0]);
      if (dirname(target) !== directory || !/^\d{3}$/.test(basename(target))) {
        return original(...args);
      }

      active++;
      maximum = Math.max(maximum, active);
      try {
        await delay(REMOVAL_DELAY_MS);
        await original(...args);
        removed++;
      } finally {
        active--;
      }
    });
    syncBuiltinESMExports();

    await (
      await new DiskBudget(directory, BUDGET, { maxAgeMs: RETENTION_MS }).reserve(10)
    )();

    assert.equal(scans.inspected, 40);
    assert.equal(removed, 40);
    assert(maximum > 1 && maximum <= SCAN_CONCURRENCY);
    assert.equal(active, 0);
    assert.deepEqual(await archiveNames(directory), []);
    assert.equal((await readInventory(directory)).bytes, 0);
  }));

test('entries are kept when no retention is configured', (context) =>
  scenario(context, 2, async (directory) => {
    await expire(directory, ['000', '001']);

    await (
      await new DiskBudget(directory, BUDGET).reserve(10)
    )();

    assert.deepEqual(await archiveNames(directory), ['000', '001']);
  }));

test('the sidecar is neither counted nor evicted under pressure', (context) =>
  scenario(context, 3, async (directory) => {
    await seedInventory(directory, { bytes: 999, scannedAt: Date.now() - 2 * HOUR_MS });
    await expire(directory, [INVENTORY_FILE]);

    // Evicting every entry is the only way to admit the reservation.
    await (
      await new DiskBudget(directory, 12, { maxAgeMs: RETENTION_MS }).reserve(12)
    )();

    assert.deepEqual(await archiveNames(directory), []);
    assert.equal((await readInventory(directory)).bytes, 0);
  }));

test('a failed sidecar write does not fail admission and the next reservation scans again', (context) =>
  scenario(context, 3, async (directory, scans) => {
    const original = fs.rename;
    const attempts: string[] = [];
    context.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (String(args[1]) === inventoryPath(directory)) {
        attempts.push(String(args[0]));

        throw Object.assign(new Error('Controlled failure'), { code: 'EACCES' });
      }

      return original(...args);
    });
    syncBuiltinESMExports();

    const budget = new DiskBudget(directory, BUDGET);
    await (
      await budget.reserve(10)
    )();

    assert.equal(attempts.length, 1);
    assert(attempts.every((source) => basename(source).startsWith('.tmp-inventory-')));
    assert.equal(scans.inspected, 3);
    await assert.rejects(access(inventoryPath(directory)));
    assert.deepEqual(
      (await readdir(directory)).filter((name) => name.startsWith('.tmp-')),
      [],
    );

    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 6);
  }));

test('a failed publication update does not fail the release and the next reservation scans', (context) =>
  scenario(context, 3, async (directory, scans) => {
    const original = fs.rename;
    let failing = false;
    context.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (failing && String(args[1]) === inventoryPath(directory)) {
        throw Object.assign(new Error('Controlled failure'), { code: 'ENOSPC' });
      }

      return original(...args);
    });
    syncBuiltinESMExports();

    const budget = new DiskBudget(directory, BUDGET);
    const release = await budget.reserve(10);
    assert.equal(scans.inspected, 3);

    failing = true;
    await release(10);
    failing = false;

    // The fresh sidecar no longer matches what this process published.
    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 6);
    assert.equal((await readInventory(directory)).bytes, 3 * ENTRY_BYTES);

    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 6);
  }));

test('insufficient disk on a reservation that skipped the scan runs one scan and checks again', (context) =>
  scenario(context, 4, async (directory, scans) => {
    const budget = new DiskBudget(directory, BUDGET, { maxAgeMs: RETENTION_MS });
    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 4);

    await expire(directory, ['000', '001']);
    const disk = mockAvailableBytes(context, (call) => (call === 1 ? 0 : 1_000_000));

    await (
      await budget.reserve(10)
    )();

    assert.equal(disk.count, 2);
    assert.equal(scans.inspected, 8);
    assert.deepEqual(await archiveNames(directory), ['002', '003']);
    assert.equal((await readInventory(directory)).bytes, 2 * ENTRY_BYTES);
  }));

test('disk that stays insufficient after the scan is refused without a second scan', (context) =>
  scenario(context, 4, async (directory, scans) => {
    const budget = new DiskBudget(directory, BUDGET);
    await (
      await budget.reserve(10)
    )();
    assert.equal(scans.inspected, 4);

    const disk = mockAvailableBytes(context, () => 0);

    await assert.rejects(budget.reserve(10), /Insufficient cache disk space/);
    assert.equal(disk.count, 2);
    assert.equal(scans.inspected, 8);

    // The refused reservation holds nothing.
    disk.count = 0;
    await assert.rejects(budget.reserve(10), /Insufficient cache disk space/);
    assert.equal(disk.count, 2);
    assert.equal(scans.inspected, 12);
  }));

test('a reservation that already scanned does not scan again when disk is insufficient', (context) =>
  scenario(context, 4, async (directory, scans) => {
    const disk = mockAvailableBytes(context, () => 0);

    await assert.rejects(
      new DiskBudget(directory, BUDGET).reserve(10),
      /Insufficient cache disk space/,
    );
    assert.equal(disk.count, 1);
    assert.equal(scans.inspected, 4);
  }));
