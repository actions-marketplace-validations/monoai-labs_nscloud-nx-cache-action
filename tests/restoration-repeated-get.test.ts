import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import type { CacheEvent } from '../src/metrics.js';
import { CacheTier, CacheOperation } from '../src/metrics.js';
import { SECOND_MS, MINUTE_MS } from '../src/units.js';

const REPEATED_GET_TEST_TIMEOUT_MS = MINUTE_MS;
const REQUEST_TIMEOUT_MS = 5 * SECOND_MS;
const CACHE_EVENT_POLL_INTERVAL_MS = 5;
const CACHE_EVENT_POLL_ATTEMPTS = 100;

const count = 512;
const bytes = Buffer.alloc(4096, 37);
const digest = createHash('sha256').update(bytes).digest('hex');
const sha = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');

async function inventory(directory: string) {
  const local = new LocalStore(directory);
  await mkdir(local.directory, { recursive: true });

  const payload = join(directory, 'shared-payload');
  await writeFile(payload, bytes);

  const metadata = JSON.stringify({
    version: 1,
    bytes: bytes.length,
    digest,
    createdAt: Date.now(),
  });

  for (let offset = 0; offset < count; offset += 32) {
    await Promise.all(
      Array.from({ length: Math.min(32, count - offset) }, async (_value, index) => {
        const entry = join(local.directory, `request-${index + offset}`);
        await mkdir(entry);
        await link(payload, join(entry, 'archive'));
        await writeFile(join(entry, 'metadata.json'), metadata);
      }),
    );
  }

  return local;
}

for (const concurrency of [1, 3]) {
  test(
    `source adapter ${count} repeated GETs at concurrency ${concurrency} retain full bodies and successful local-hit events`,
    { timeout: REPEATED_GET_TEST_TIMEOUT_MS },
    async (context) => {
      const directory = await mkdtemp(join(tmpdir(), 'nx-repeated-get-'));
      const events: CacheEvent[] = [];
      const local = await inventory(directory);

      const server = await startServer({
        local,
        readOnly: true,
        failOpen: false,
        record: (event) => events.push(event),
      });

      const closeResponses: number[] = [];
      try {
        for (let offset = 0; offset < count; offset += concurrency) {
          await Promise.all(
            Array.from({ length: Math.min(concurrency, count - offset) }, async (_value, item) => {
              const index = offset + item;
              const response = await fetch(`${server.url}/v1/cache/request-${index}`, {
                headers: { authorization: `Bearer ${server.token}` },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
              });
              const body = Buffer.from(await response.arrayBuffer());

              assert.equal(response.status, 200);
              assert.equal(body.length, bytes.length);
              assert.equal(sha(body), digest);

              if (response.headers.get('connection') === 'close') {
                closeResponses.push(index);
              }
            }),
          );
        }

        for (
          let iteration = 0;
          iteration < CACHE_EVENT_POLL_ATTEMPTS && events.length < count;
          iteration++
        ) {
          await delay(CACHE_EVENT_POLL_INTERVAL_MS);
        }

        assert.equal(events.length, count, 'one terminal event per request');
        assert.equal(new Set(events.map((event) => event.hash)).size, count);

        const errors = events.filter((event) => event.tier !== CacheTier.Local);

        context.diagnostic(
          JSON.stringify({
            scenario: 'source-repeated-get',
            node: process.version,
            platform: process.platform,
            concurrency,
            requests: count,
            completeBodyProofs: count,
            closeResponses,
            nonLocalEvents: errors.map((event) => ({
              index: Number(event.hash.slice('request-'.length)),
              operation: event.operation,
              tier: event.tier,
              errorCode: event.errorCode ?? 'none',
            })),
          }),
        );

        assert(events.every((event) => event.operation === CacheOperation.Get));
        assert.equal(errors.length, 0, 'complete responses must record successful local hits');
        assert(events.every((event) => event.bytes === bytes.length));
        assert.equal(sha(await readFile((await local.get('request-511')) ?? '')), digest);
      } finally {
        await server.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
}
