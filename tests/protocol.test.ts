import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { connect } from 'node:net';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import type { RemoteStore } from '../src/artifact-store.js';
import type { CacheEvent } from '../src/metrics.js';

import { chunks, deferred, withTemporaryDirectory as sandbox } from './helpers.js';
import { HttpMethod, HttpStatus } from '../src/http.js';
import { CacheTier, CacheOperation } from '../src/metrics.js';
import { SECOND_MS } from '../src/units.js';

const QUEUE_OBSERVATION_DELAY_MS = 20;
const REMOTE_LOOKUP_LATENCY_MS = 30;
const REQUEST_CLEANUP_POLL_INTERVAL_MS = 10;
const UPLOAD_DEADLINE_OBSERVATION_MS = 60;
const SHORT_QUEUE_DEADLINE_MS = 25;
const HEALTHY_REQUEST_DEADLINE_MS = SECOND_MS;
const STALLED_LOOKUP_DEADLINE_MS = 50;
const STALLED_UPLOAD_DEADLINE_MS = 30;
const UPLOAD_QUEUE_DEADLINE_MS = 80;

test('local miss fills from remote; local hit does not consult remote; writes await publication', async () =>
  sandbox(async (directory) => {
    const events: CacheEvent[] = [];
    let lookups = 0;
    let published = false;
    const remote: RemoteStore = {
      async get(hash) {
        lookups++;

        return hash === 'remote' ? chunks('archive') : null;
      },
      async put(_hash, file) {
        assert.equal(await readFile(file, 'utf8'), 'uploaded');

        published = true;

        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: (event) => events.push(event),
    });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      assert.equal((await fetch(`${server.url}/v1/cache/absent`, { headers })).status, 404);

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/remote`, { headers })).text(),
        'archive',
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/remote`, { headers })).text(),
        'archive',
      );
      assert.equal(lookups, 2);

      assert.equal(
        (
          await fetch(`${server.url}/v1/cache/new`, {
            method: HttpMethod.Put,
            headers,
            body: 'uploaded',
          })
        ).status,
        200,
      );
      assert(published);

      assert.equal((await fetch(`${server.url}/v1/cache/new`)).status, 401);

      assert(events.some((event) => event.tier === CacheTier.Artifact));
      assert(events.some((event) => event.tier === CacheTier.Local));
    } finally {
      await server.close();
    }

    await assert.rejects(fetch(`${server.url}/v1/cache/new`, { headers }));
  }));

test('read-only client cannot populate either tier', async () =>
  sandbox(async (directory) => {
    const server = await startServer({
      local: new LocalStore(directory),
      readOnly: true,
      record: () => {},
    });

    try {
      const response = await fetch(`${server.url}/v1/cache/new`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'not stored',
      });
      assert.equal(response.status, 403);
      assert.equal(await new LocalStore(directory).get('new'), null);
    } finally {
      await server.close();
    }
  }));

test('failed shared publication removes newly published local entry', async () =>
  sandbox(async (directory) => {
    const remote: RemoteStore = {
      async get() {
        return null;
      },
      async put() {
        throw new Error('offline');
      },
    };
    const store = new LocalStore(directory);
    const server = await startServer({ local: store, remote, record: () => {} });

    try {
      const response = await fetch(`${server.url}/v1/cache/new`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'archive',
      });
      assert.equal(response.status, 500);
      assert.equal(await store.get('new'), null);
    } finally {
      await server.close();
    }
  }));

test('existing shared entry becomes canonical for a new local cache', async () =>
  sandbox(async (directory) => {
    const remote: RemoteStore = {
      async get() {
        return chunks('canonical');
      },
      async put() {
        return false;
      },
    };
    const store = new LocalStore(directory);
    const events: CacheEvent[] = [];
    const server = await startServer({
      local: store,
      remote,
      record: (event) => events.push(event),
    });

    try {
      const response = await fetch(`${server.url}/v1/cache/new`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'other archive',
      });
      assert.equal(response.status, 409);
      assert.equal(await readFile(join(store.directory, 'new', 'archive'), 'utf8'), 'canonical');
      assert.equal(
        events.filter(
          (event) =>
            event.operation === CacheOperation.Publish && event.tier === CacheTier.AlreadyPresent,
        ).length,
        1,
      );
      assert.equal(
        events.filter(
          (event) =>
            event.operation === CacheOperation.Publish && event.tier === CacheTier.Artifact,
        ).length,
        0,
      );
    } finally {
      await server.close();
    }
  }));

for (const corruption of ['size', 'digest', 'metadata']) {
  test(`${corruption} corruption recovers from remote and then hits local`, () =>
    sandbox(async (directory) => {
      const store = new LocalStore(directory);
      await store.receive('broken', chunks('original'));

      const archive = join(store.directory, 'broken', 'archive');
      const description = join(store.directory, 'broken', 'metadata.json');
      if (corruption === 'size') {
        await writeFile(archive, 'short');
      } else if (corruption === 'digest') {
        await writeFile(archive, 'modified');
      } else {
        await writeFile(description, '{bad');
      }

      let lookups = 0;
      const events: CacheEvent[] = [];
      const remote: RemoteStore = {
        async get() {
          lookups++;

          return chunks('canonical');
        },
        async put() {
          return true;
        },
      };

      const server = await startServer({
        local: store,
        remote,
        record: (event) => events.push(event),
      });
      const headers = { authorization: `Bearer ${server.token}` };
      let closed = false;
      try {
        assert.equal(
          await (await fetch(`${server.url}/v1/cache/broken`, { headers })).text(),
          'canonical',
        );

        assert.equal(
          await (await fetch(`${server.url}/v1/cache/broken`, { headers })).text(),
          'canonical',
        );

        await server.close();
        closed = true;

        assert.equal(lookups, 1);
        assert.equal(events.filter((event) => event.tier === CacheTier.Corrupt).length, 1);
        assert.equal(events.filter((event) => event.tier === CacheTier.Local).length, 1);
      } finally {
        if (!closed) {
          await server.close();
        }
      }
    }));
}

test('corrupt entry without remote becomes miss and next PUT repairs it', () =>
  sandbox(async (directory) => {
    const store = new LocalStore(directory);
    const entry = await store.receive('broken', chunks('original'));
    await writeFile(entry.file, 'modified');

    const server = await startServer({ local: store, record: () => {} });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      assert.equal((await fetch(`${server.url}/v1/cache/broken`, { headers })).status, 404);

      assert.equal(
        (
          await fetch(`${server.url}/v1/cache/broken`, {
            method: HttpMethod.Put,
            headers,
            body: 'repaired',
          })
        ).status,
        200,
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/broken`, { headers })).text(),
        'repaired',
      );
    } finally {
      await server.close();
    }
  }));

test('concurrent recovery leaves one valid canonical local entry', () =>
  sandbox(async (directory) => {
    const store = new LocalStore(directory);
    const entry = await store.receive('broken', chunks('original'));
    await writeFile(entry.file, 'modified');

    const remote: RemoteStore = {
      async get() {
        return chunks('canonical');
      },
      async put() {
        return true;
      },
    };
    const server = await startServer({ local: store, remote, record: () => {} });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => fetch(`${server.url}/v1/cache/broken`, { headers })),
      );
      assert(responses.every((response) => response.status === HttpStatus.Ok));
      assert(
        (await Promise.all(responses.map((response) => response.text()))).every(
          (value) => value === 'canonical',
        ),
      );

      assert.equal(await readFile((await store.get('broken')) ?? '', 'utf8'), 'canonical');
      assert.deepEqual(await readdir(store.directory), ['broken']);
    } finally {
      await server.close();
    }
  }));

test('fail-open converts remote failures to misses and retains local writes', () =>
  sandbox(async (directory) => {
    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get() {
        throw new Error('backend unavailable');
      },
      async put() {
        throw new Error('backend unavailable');
      },
    };
    const store = new LocalStore(directory);
    const server = await startServer({
      local: store,
      remote,
      failOpen: true,
      record: (event) => events.push(event),
    });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      assert.equal((await fetch(`${server.url}/v1/cache/absent`, { headers })).status, 404);

      assert.equal(
        (
          await fetch(`${server.url}/v1/cache/new`, {
            method: HttpMethod.Put,
            headers,
            body: 'archive',
          })
        ).status,
        200,
      );
      assert.equal(await readFile((await store.get('new')) ?? '', 'utf8'), 'archive');
      assert(
        events.some(
          (event) =>
            event.operation === CacheOperation.Remote && event.tier === CacheTier.Unavailable,
        ),
      );
      assert.equal(
        events.filter(
          (event) => event.operation === CacheOperation.Get && event.tier === CacheTier.Miss,
        ).length,
        0,
      );
      assert(
        events.some(
          (event) => event.operation === CacheOperation.Put && event.tier === CacheTier.Local,
        ),
      );
    } finally {
      await server.close();
    }
  }));

test('local ENOSPC after a successful remote GET is a local error', () =>
  sandbox(async (directory) => {
    class FullStore extends LocalStore {
      override async receive(): Promise<{ file: string; created: boolean; bytes: number }> {
        throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      }
    }

    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get() {
        return chunks('archive');
      },
      async put() {
        return true;
      },
    };
    const server = await startServer({
      local: new FullStore(directory),
      remote,
      record: (event) => events.push(event),
    });

    try {
      const response = await fetch(`${server.url}/v1/cache/remote`, {
        headers: { authorization: `Bearer ${server.token}` },
      });
      assert.equal(response.status, 500);
      assert(
        events.some(
          (event) =>
            event.operation === CacheOperation.Get &&
            event.tier === CacheTier.Error &&
            event.errorCode === 'ENOSPC',
        ),
      );
      assert.equal(events.filter((event) => event.tier === CacheTier.Unavailable).length, 0);
    } finally {
      await server.close();
    }
  }));

test('declared oversized uploads are rejected before archive creation', () =>
  sandbox(async (directory) => {
    const store = new LocalStore(directory, 2);
    const server = await startServer({ local: store, record: () => {} });

    try {
      const response = await fetch(`${server.url}/v1/cache/large`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'too large',
      });
      assert.equal(response.status, 413);
      assert.equal(await store.get('large'), null);
    } finally {
      await server.close();
    }
  }));

test('request admission waits for a slot while an Artifact lookup is pending', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const started = deferred();
    const remote: RemoteStore = {
      async get() {
        started.resolve();
        await held.promise;

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: () => {},
      maxConcurrentRequests: 1,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await started.promise;

      const second = fetch(`${server.url}/v1/cache/second`, { headers });

      await new Promise((resolve) => setTimeout(resolve, QUEUE_OBSERVATION_DELAY_MS));
      held.resolve();
      assert.equal((await second).status, 404);
    } finally {
      held.resolve();
      assert.equal((await first).status, 404);

      await server.close();
    }
  }));

test('request admission classifies true queue exhaustion', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const started = deferred();
    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get() {
        started.resolve();
        await held.promise;

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: (event) => events.push(event),
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await started.promise;

      assert.equal((await fetch(`${server.url}/v1/cache/second`, { headers })).status, 503);
      assert(events.some((event) => event.tier === CacheTier.Overload));
    } finally {
      held.resolve();
      await first;
      await server.close();
    }
  }));

test('queued requests have a deadline and overload remains distinct from a genuine miss', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const started = deferred();
    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get(hash) {
        if (hash === 'first') {
          started.resolve();
          await held.promise;
        }

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: (event) => events.push(event),
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      queueWaitMs: SHORT_QUEUE_DEADLINE_MS,
      requestDeadlineMs: HEALTHY_REQUEST_DEADLINE_MS,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await started.promise;

      assert.equal((await fetch(`${server.url}/v1/cache/second`, { headers })).status, 503);
      assert.equal(events.filter((event) => event.tier === CacheTier.Overload).length, 1);
      assert.equal(events.filter((event) => event.tier === CacheTier.Miss).length, 0);
    } finally {
      held.resolve();
      await first;
      await server.close();
    }
  }));

test('fail-open overload is recorded even when its protocol response is a miss', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const started = deferred();
    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get() {
        started.resolve();
        await held.promise;

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: (event) => events.push(event),
      failOpen: true,
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await started.promise;

      assert.equal((await fetch(`${server.url}/v1/cache/second`, { headers })).status, 404);
      assert.equal(events.filter((event) => event.tier === CacheTier.Overload).length, 1);
      assert.equal(events.filter((event) => event.tier === CacheTier.Miss).length, 0);
    } finally {
      held.resolve();
      await first;
      await server.close();
    }
  }));

for (const count of [33, 64]) {
  test(`${count} overlapping cold Artifact reads return bytes without overload`, () =>
    sandbox(async (directory) => {
      let active = 0;
      let peak = 0;
      const events: CacheEvent[] = [];
      const remote: RemoteStore = {
        async get(hash) {
          active++;
          peak = Math.max(peak, active);

          try {
            await new Promise((resolve) => setTimeout(resolve, REMOTE_LOOKUP_LATENCY_MS));

            return chunks(hash);
          } finally {
            active--;
          }
        },
        async put() {
          throw new Error('unexpected publication');
        },
      };

      const server = await startServer({
        local: new LocalStore(directory),
        remote,
        record: (event) => events.push(event),
      });
      const headers = { authorization: `Bearer ${server.token}` };

      const started = performance.now();
      let closed = false;
      try {
        const results = await Promise.all(
          Array.from({ length: count }, (_, index) =>
            fetch(`${server.url}/v1/cache/hash${index}`, { headers }),
          ),
        );
        assert(results.every((response) => response.status === HttpStatus.Ok));
        assert.deepEqual(
          await Promise.all(results.map((response) => response.text())),
          Array.from({ length: count }, (_, index) => `hash${index}`),
        );

        await server.close();
        closed = true;

        assert(peak <= 32);
        assert.equal(
          events.filter(
            (event) => event.tier === CacheTier.Overload || event.tier === CacheTier.Miss,
          ).length,
          0,
        );
        assert.equal(events.filter((event) => event.tier === CacheTier.Artifact).length, count);
        assert(performance.now() - started < 10000);
      } finally {
        if (!closed) {
          await server.close();
        }
      }
    }));
}

test('cancelled queued client releases capacity for the next request', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const firstEntered = deferred();
    const remote: RemoteStore = {
      async get(hash) {
        if (hash === 'first') {
          firstEntered.resolve();
          await held.promise;
        }

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: () => {},
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await firstEntered.promise;

      const controller = new AbortController();
      const cancelled = fetch(`${server.url}/v1/cache/cancelled`, {
        headers,
        signal: controller.signal,
      });

      await new Promise((resolve) => setTimeout(resolve, QUEUE_OBSERVATION_DELAY_MS));
      controller.abort();

      await assert.rejects(cancelled);

      const next = fetch(`${server.url}/v1/cache/next`, { headers });

      held.resolve();
      assert.equal((await next).status, 404);
    } finally {
      held.resolve();
      await first;
      await server.close();
    }
  }));

test('aborted admitted GET releases its slot while remote lookup is pending', () =>
  sandbox(async (directory) => {
    const started = deferred();
    const secondStarted = deferred();
    const secondHeld = deferred();
    let rejectFirst: (error: Error) => void = () => {};
    let observedSignal: AbortSignal | undefined;
    const remote: RemoteStore = {
      get(hash, signal) {
        if (hash === 'first') {
          observedSignal = signal;
          started.resolve();

          return new Promise((_, reject) => {
            rejectFirst = reject;
          });
        }

        if (hash === 'second') {
          secondStarted.resolve();

          return secondHeld.promise.then(() => null);
        }

        return Promise.resolve(null);
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: () => {},
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const controller = new AbortController();
    const first = fetch(`${server.url}/v1/cache/first`, { headers, signal: controller.signal });
    try {
      await started.promise;
      controller.abort();

      await assert.rejects(first);

      for (let attempt = 0; attempt < 20 && !observedSignal?.aborted; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_CLEANUP_POLL_INTERVAL_MS));
      }

      assert.equal(observedSignal?.aborted, true);

      const second = fetch(`${server.url}/v1/cache/second`, { headers });

      await secondStarted.promise;

      assert.equal((await fetch(`${server.url}/v1/cache/third`, { headers })).status, 503);

      secondHeld.resolve();
      assert.equal((await second).status, 404);

      rejectFirst(new Error('late remote failure'));
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      controller.abort();
      secondHeld.resolve();
      await server.close();
    }
  }));

test('active request deadline releases its slot even if remote ignores cancellation', () =>
  sandbox(async (directory) => {
    const started = deferred();
    let observedSignal: AbortSignal | undefined;
    const remote: RemoteStore = {
      get(hash, signal) {
        if (hash === 'first') {
          observedSignal = signal;
          started.resolve();

          return new Promise(() => {});
        }

        return Promise.resolve(null);
      },
      async put() {
        return true;
      },
    };
    const events: CacheEvent[] = [];

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      record: (event) => events.push(event),
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
      requestDeadlineMs: STALLED_LOOKUP_DEADLINE_MS,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      const first = fetch(`${server.url}/v1/cache/first`, { headers });

      await started.promise;

      assert.equal((await first).status, 503);
      assert.equal(observedSignal?.aborted, true);

      assert.equal((await fetch(`${server.url}/v1/cache/second`, { headers })).status, 404);

      assert(
        events.some(
          (event) => event.operation === CacheOperation.Get && event.errorCode === 'timeout',
        ),
      );
    } finally {
      await server.close();
    }
  }));

test('stalled admitted PUT expires, closes its input and frees admission', () =>
  sandbox(async (directory) => {
    const store = new LocalStore(directory);
    const events: CacheEvent[] = [];
    const server = await startServer({
      local: store,
      record: (event) => events.push(event),
      maxConcurrentRequests: 1,
      maxQueuedRequests: 1,
      requestDeadlineMs: STALLED_UPLOAD_DEADLINE_MS,
      queueWaitMs: UPLOAD_QUEUE_DEADLINE_MS,
    });

    const address = new URL(server.url);
    const socket = connect(Number(address.port), address.hostname);
    try {
      await new Promise<void>((resolve) => socket.once('connect', resolve));
      socket.write(
        `PUT /v1/cache/stalled HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${server.token}\r\nContent-Length: 100\r\n\r\na`,
      );
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_DEADLINE_OBSERVATION_MS));

      const response = await fetch(`${server.url}/v1/cache/next`, {
        headers: { authorization: `Bearer ${server.token}` },
      });
      assert.equal(response.status, 404);
      assert(
        events.some(
          (event) =>
            event.operation === CacheOperation.Put &&
            event.tier === CacheTier.Error &&
            event.errorCode === 'timeout',
        ),
      );
      assert.equal(await store.get('stalled'), null);

      let entries = await readdir(store.directory);
      for (let attempt = 0; attempt < 20 && entries.length; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_CLEANUP_POLL_INTERVAL_MS));
        entries = await readdir(store.directory);
      }

      assert.deepEqual(entries, []);
    } finally {
      socket.destroy();
      await server.close();
    }
  }));

test('late local PUT failure after deadline is handled without reusing the slot', () =>
  sandbox(async (directory) => {
    let rejectReceive: (error: Error) => void = () => {};

    class StalledStore extends LocalStore {
      override receive(): Promise<{ file: string; created: boolean; bytes: number }> {
        return new Promise((_, reject) => {
          rejectReceive = reject;
        });
      }
    }

    const server = await startServer({
      local: new StalledStore(directory),
      record: () => {},
      maxConcurrentRequests: 1,
      maxQueuedRequests: 0,
      requestDeadlineMs: STALLED_UPLOAD_DEADLINE_MS,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      const first = await fetch(`${server.url}/v1/cache/stalled`, {
        method: HttpMethod.Put,
        headers,
        body: 'archive',
      });
      assert.equal(first.status, 503);

      assert.equal((await fetch(`${server.url}/v1/cache/next`, { headers })).status, 404);

      rejectReceive(new Error('late local failure'));
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      rejectReceive(new Error('cleanup'));
      await server.close();
    }
  }));

test('queued GET and PUT both complete after a slow active lookup', () =>
  sandbox(async (directory) => {
    const held = deferred();
    const started = deferred();
    const events: CacheEvent[] = [];
    const remote: RemoteStore = {
      async get(hash) {
        if (hash === 'first') {
          started.resolve();
          await held.promise;
        }

        return null;
      },
      async put() {
        return true;
      },
    };

    const server = await startServer({
      local: new LocalStore(directory),
      remote,
      remoteReadOnly: true,
      record: (event) => events.push(event),
      maxConcurrentRequests: 1,
      maxQueuedRequests: 2,
    });
    const headers = { authorization: `Bearer ${server.token}` };

    const first = fetch(`${server.url}/v1/cache/first`, { headers });
    try {
      await started.promise;

      const put = fetch(`${server.url}/v1/cache/written`, {
        method: HttpMethod.Put,
        headers,
        body: 'archive',
      });
      const get = fetch(`${server.url}/v1/cache/absent`, { headers });

      held.resolve();
      assert.equal((await first).status, 404);
      assert.equal((await put).status, 200);
      assert.equal((await get).status, 404);

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/written`, { headers })).text(),
        'archive',
      );
      assert.equal(events.filter((event) => event.tier === CacheTier.Overload).length, 0);
    } finally {
      held.resolve();
      await server.close();
    }
  }));
