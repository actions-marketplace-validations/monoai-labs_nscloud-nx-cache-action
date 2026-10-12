import assert from 'node:assert/strict';
import test from 'node:test';
import { seedFixtures } from '../bench/restoration/seed.js';

test('seed rejects unowned paths and malformed payload metadata before loading credentials', async () => {
  const prefix = `nx-cache/benchmark-restoration/test/${'a'.repeat(64)}`;

  await assert.rejects(seedFixtures('nx-cache/production', []), /benchmark-owned/);

  await assert.rejects(
    seedFixtures(prefix, [
      { hash: '../production', file: 'unused', digest: 'b'.repeat(64), bytes: 1 },
    ]),
    /Invalid cache hash/,
  );

  await assert.rejects(
    seedFixtures(prefix, [{ hash: 'valid', file: 'unused', digest: 'incorrect', bytes: 1 }]),
    /Invalid synthetic fixture/,
  );
});

test('an exhausted qualification budget cannot begin remote seeding', async () => {
  const controller = new AbortController();
  controller.abort(new Error('owned-budget-expired'));

  await assert.rejects(
    seedFixtures(
      `nx-cache/benchmark-restoration/test/${'a'.repeat(64)}`,
      [],
      'ord',
      undefined,
      controller.signal,
    ),
    /owned-budget-expired/,
  );
});
