import type { CacheEvent } from '../src/metrics.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import { chunks } from './helpers.js';
import { CacheOperation, CacheTier } from '../src/metrics.js';
import { KIBIBYTE, SECOND_MS } from '../src/units.js';

const STREAM_TEST_TIMEOUT_MS = 10 * SECOND_MS;
const REQUEST_TIMEOUT_MS = 5 * SECOND_MS;
const CACHE_EVENT_POLL_INTERVAL_MS = 10;
const CACHE_EVENT_POLL_ATTEMPTS = 100;
const DELAYED_EOF_MS = 100;
const PARTIAL_BODY_DELAY_MS = 250;
const REQUEST_DEADLINE_MS = 100;
const StreamCancellationMode = Object.freeze({ Disconnect: 'disconnect', Deadline: 'deadline' });

async function waitForEvent(events: CacheEvent[], hash: string) {
  for (let attempt = 0; attempt < CACHE_EVENT_POLL_ATTEMPTS; attempt++) {
    const event = events.find(
      (value) => value.operation === CacheOperation.Get && value.hash === hash,
    );
    if (event) {
      return event;
    }

    await new Promise((resolve) => setTimeout(resolve, CACHE_EVENT_POLL_INTERVAL_MS));
  }

  throw new Error('terminal GET event missing');
}

for (const tier of ['local', 'artifact']) {
  test(
    `a client closing after Content-Length bytes still records a complete ${tier} GET`,
    { timeout: STREAM_TEST_TIMEOUT_MS },
    async (context) => {
      const directory = await mkdtemp(join(tmpdir(), 'nx-stream-completion-'));
      const bytes = Buffer.alloc(4096, 37);
      const local = new LocalStore(directory);
      if (tier === CacheTier.Local) {
        await local.receive('complete', chunks(bytes));
      }

      // Keep the redundant EOF read pending after the client has consumed the body.
      const originalRead = fs.read;
      let delayedEofReads = 0;

      function delayedRead(
        fd: number,
        data: Buffer,
        offset: number,
        length: number,
        position: number | null,
        callback: (error: NodeJS.ErrnoException | null, count: number, buffer: Buffer) => void,
      ) {
        return originalRead(fd, data, offset, length, position, (error, count, buffer) => {
          if (!error && count === 0) {
            delayedEofReads++;
            setTimeout(() => callback(error, count, buffer), DELAYED_EOF_MS);
          } else {
            callback(error, count, buffer);
          }
        });
      }

      context.mock.method(fs, 'read', delayedRead);

      const events: CacheEvent[] = [];
      const server = await startServer({
        local,
        readOnly: true,
        failOpen: false,
        record: (event) => events.push(event),
        remote: {
          async get() {
            return chunks(bytes);
          },
          async put() {
            throw new Error('unexpected publication');
          },
        },
      });

      try {
        const response = await fetch(`${server.url}/v1/cache/complete`, {
          headers: { authorization: `Bearer ${server.token}`, connection: 'close' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        assert.equal(response.status, 200);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      } finally {
        await server.close();
        context.mock.restoreAll();
        await rm(directory, { recursive: true, force: true });
      }

      context.diagnostic(
        JSON.stringify({
          scenario: 'delayed-eof-completion',
          completeBody: true,
          delayedEofReads,
          events: events.map(({ operation, tier, bytes, errorCode }) => ({
            operation,
            tier,
            bytes,
            errorCode,
          })),
        }),
      );

      assert.equal(events.length, 1);

      const event = events[0];
      assert(event);
      assert.equal(event.tier, tier);
      assert.equal(event.bytes, bytes.length);
    },
  );
}

for (const mode of [StreamCancellationMode.Disconnect, StreamCancellationMode.Deadline]) {
  test(
    `${mode} during a partial GET remains an error and releases admission`,
    { timeout: STREAM_TEST_TIMEOUT_MS },
    async (context) => {
      const directory = await mkdtemp(join(tmpdir(), 'nx-stream-cancellation-'));
      const bytes = Buffer.alloc(256 * KIBIBYTE, 37);
      const local = new LocalStore(directory);
      await local.receive('partial', chunks(bytes));
      await local.receive('next', chunks('healthy'));

      const originalRead = fs.read;
      let reads = 0;
      let stalled = false;

      function delayedRead(
        fd: number,
        data: Buffer,
        offset: number,
        length: number,
        position: number | null,
        callback: (error: NodeJS.ErrnoException | null, count: number, buffer: Buffer) => void,
      ) {
        return originalRead(fd, data, offset, length, position, (error, count, buffer) => {
          if (!error && count > 0 && ++reads === 2) {
            stalled = true;
            setTimeout(() => callback(error, count, buffer), PARTIAL_BODY_DELAY_MS);
          } else {
            callback(error, count, buffer);
          }
        });
      }

      context.mock.method(fs, 'read', delayedRead);

      const events: CacheEvent[] = [];
      const server = await startServer({
        local,
        readOnly: true,
        failOpen: false,
        record: (event) => events.push(event),
        maxConcurrentRequests: 1,
        maxQueuedRequests: 0,
        requestDeadlineMs:
          mode === StreamCancellationMode.Deadline ? REQUEST_DEADLINE_MS : REQUEST_TIMEOUT_MS,
      });
      const controller = new AbortController();
      const headers = { authorization: `Bearer ${server.token}` };

      try {
        const response = await fetch(`${server.url}/v1/cache/partial`, {
          headers,
          signal: controller.signal,
        });
        assert.equal(response.status, 200);
        assert(response.body);

        const reader = response.body.getReader();
        const first = await reader.read();
        assert(first.value && first.value.length < bytes.length);

        if (mode === StreamCancellationMode.Disconnect) {
          controller.abort();
        }

        await assert.rejects(async () => {
          while (!(await reader.read()).done) {}
        });

        const event = await waitForEvent(events, 'partial');

        assert.equal(stalled, true);
        assert.equal(event.tier, 'error');
        assert.equal(event.errorCode, 'timeout');
        assert.equal(events.filter((value) => value.hash === 'partial').length, 1);

        const next = await fetch(`${server.url}/v1/cache/next`, { headers });
        assert.equal(next.status, 200);
        assert.equal(await next.text(), 'healthy');
        assert.equal((await waitForEvent(events, 'next')).tier, 'local');
      } finally {
        controller.abort();
        await server.close();
        context.mock.restoreAll();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
}

test(
  'empty remote archives remain integrity failures before response headers',
  { timeout: STREAM_TEST_TIMEOUT_MS },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nx-empty-restoration-'));
    const local = new LocalStore(directory);

    const events: CacheEvent[] = [];
    const server = await startServer({
      local,
      failOpen: false,
      record: (event) => events.push(event),
      remote: {
        async get() {
          return (async function* () {})();
        },
        async put() {
          throw new Error('unexpected publication');
        },
      },
    });

    try {
      const response = await fetch(`${server.url}/v1/cache/empty`, {
        headers: { authorization: `Bearer ${server.token}` },
      });
      assert.equal(response.status, 500);

      await response.arrayBuffer();
      assert.equal((await waitForEvent(events, 'empty')).errorCode, 'integrity');
      assert.equal(await local.get('empty'), null);
    } finally {
      await server.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
