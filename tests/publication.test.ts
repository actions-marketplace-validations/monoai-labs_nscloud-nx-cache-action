import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PublicationQueue } from '../src/publication-queue.js';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import { runCachedCommand } from '../src/cache-command.js';
import type { CacheEvent } from '../src/metrics.js';
import { CacheMetrics } from '../src/metrics.js';
import { renderCacheSummary } from '../src/summary.js';
import { deferred } from './helpers.js';
import { HttpMethod } from '../src/http.js';
import { ProcessSignal } from '../src/process-constants.js';
import { Code, ConnectError } from '@connectrpc/connect';
import { artifactStoreFor } from '../src/artifact-store.js';
import {
  createResponse,
  finalizeResponse,
  scriptedApi,
  uploadServer,
  type ApiScript,
} from './artifact-fakes.js';

const ARCHIVE_BYTES = 7;
const PUBLICATION_CONCURRENCY = 10;
const SHUTDOWN_TEST_TIMEOUT_MS = 10_000;
const EXHAUSTED_ATTEMPTS = 4;
const TERMINATED_EXIT_CODE = 143;

test('background mode without a shared backend records only local storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-local-publication-'));
  const events: CacheEvent[] = [];
  const server = await startServer({
    local: new LocalStore(directory),
    backgroundPublication: true,
    record: (event) => events.push(event),
  });

  try {
    const response = await fetch(`${server.url}/v1/cache/abc`, {
      method: HttpMethod.Put,
      headers: { Authorization: `Bearer ${server.token}` },
      body: 'archive',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(
      events.map((event) => [event.operation, event.tier]),
      [['put', 'local']],
    );
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('wrapper drains after task failure and preserves its exit code', async () => {
  let drained = false;
  const server = {
    url: 'http://127.0.0.1',
    token: 'test',
    close: async () => {
      drained = true;

      throw new Error('publication failed');
    },
  };

  assert.equal(
    await runCachedCommand(server, process.execPath, ['-e', 'process.exit(7)'], process.env),
    7,
  );
  assert(drained);

  assert.equal(
    await runCachedCommand(server, process.execPath, ['-e', 'process.exit(0)'], process.env),
    1,
  );
});

test('cancellation during drain waits for publication and preserves cancellation status', async () => {
  const entered = deferred();
  const release = deferred();
  const server = {
    url: 'http://127.0.0.1',
    token: 'test',
    close: async () => {
      entered.resolve();
      await release.promise;
    },
  };
  let finished = false;
  const run = runCachedCommand(
    server,
    process.execPath,
    ['-e', 'process.exit(0)'],
    process.env,
  ).then((code) => {
    finished = true;

    return code;
  });

  await entered.promise;
  process.emit(ProcessSignal.Terminate);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(finished, false);

  release.resolve();
  assert.equal(await run, 143);
});

test('publication admission is bounded, duplicate hashes coalesce, drain waits', async () => {
  const queue = new PublicationQueue(2);
  const gate = deferred();
  let started = 0;
  const publish = async () => {
    started++;
    await gate.promise;
  };

  await queue.add('a', publish);
  await queue.add('a', publish);
  await queue.add('b', publish);

  let admitted = false;
  const third = queue.add('c', publish).then(() => {
    admitted = true;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, 2);
  assert.equal(admitted, false);

  let drained = false;
  const drain = queue.drain().then(() => {
    drained = true;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(drained, false);

  gate.resolve();
  await third;
  await drain;
  assert.equal(started, 3);
});

test('local acceptance precedes publication; shutdown reports publication failure and closes listener', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-publication-'));
  const local = new LocalStore(directory);
  const gate = deferred();
  const server = await startServer({
    local,
    backgroundPublication: true,
    record: () => {},
    remote: {
      get: async () => null,
      put: async () => {
        await gate.promise;

        throw new Error('failed');
      },
    },
  });

  try {
    const headers = { Authorization: `Bearer ${server.token}` };
    const response = await fetch(`${server.url}/v1/cache/abc`, {
      method: HttpMethod.Put,
      headers,
      body: 'archive',
    });
    assert.equal(response.status, 200);

    assert.equal(await (await fetch(`${server.url}/v1/cache/abc`, { headers })).text(), 'archive');

    const closing = server.close();

    gate.resolve();

    await assert.rejects(closing, /Cache publication failed/);
    assert.equal(await local.get('abc'), null);
    await assert.rejects(fetch(`${server.url}/v1/cache/abc`, { headers }));
  } finally {
    gate.resolve();
    await rm(directory, { recursive: true, force: true });
  }
});

test('command completion drains publication before summary aggregation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-summary-drain-'));
  const gate = deferred();
  const entered = deferred();
  const metrics = new CacheMetrics(() => {});

  const server = await startServer({
    local: new LocalStore(directory),
    backgroundPublication: true,
    record: metrics.record,
    remote: {
      get: async () => null,
      put: async () => {
        entered.resolve();
        await gate.promise;

        return true;
      },
    },
  });

  const child = `fetch(process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER + '/v1/cache/abc', {method:'PUT',headers:{authorization:'Bearer ' + process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN},body:'archive'}).then(response => { if (!response.ok) process.exit(2); })`;

  try {
    const running = runCachedCommand(server, process.execPath, ['-e', child], process.env);

    await entered.promise;
    assert.equal(metrics.snapshot().publications.count, 0);

    gate.resolve();
    assert.equal(await running, 0);
    assert.equal(metrics.snapshot().publications.bytes, 7);
    assert.match(renderCacheSummary(metrics.snapshot()), /\| Artifact publications \| 1 \|/);
  } finally {
    gate.resolve();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a publication waiting to retry releases its slot and takes one again afterwards', async () => {
  const queue = new PublicationQueue(1);
  const idling = deferred();
  const wake = deferred();
  const holding = deferred();
  const order: string[] = [];
  let admittedSecond = false;

  await queue.add('a', async (slot) => {
    order.push('a:start');
    await slot.idle(async () => {
      idling.resolve();
      await wake.promise;
    });
    order.push('a:resume');
  });
  await idling.promise;

  void queue
    .add('b', async () => {
      order.push('b:start');
      await holding.promise;
      order.push('b:end');
    })
    .then(() => {
      admittedSecond = true;
    });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(admittedSecond, true);
  assert.deepEqual(order, ['a:start', 'b:start']);

  wake.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['a:start', 'b:start']);

  holding.resolve();
  await queue.drain();
  assert.deepEqual(order, ['a:start', 'b:start', 'b:end', 'a:resume']);
});

/** Starts a server whose remote is the real Artifact store over scripted fakes. */
async function retryingServer(
  context: TestContext,
  options: {
    script: (uploadUrl: string) => ApiScript;
    sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
    failOpen?: boolean;
  },
) {
  const directory = await mkdtemp(join(tmpdir(), 'nx-publication-retry-'));
  const upload = await uploadServer();
  const events: CacheEvent[] = [];
  const { api, calls } = scriptedApi(options.script(upload.url));
  const server = await startServer({
    local: new LocalStore(directory),
    backgroundPublication: true,
    failOpen: options.failOpen ?? false,
    record: (event) => events.push(event),
    remote: artifactStoreFor(api, 'tests/prefix', { sleep: options.sleep }),
  });
  context.after(async () => {
    await server.close().catch(() => {});
    await upload.close();
    await rm(directory, { recursive: true, force: true });
  });

  return {
    server,
    calls,
    events,
    put: (hash: string, body = hash) =>
      fetch(`${server.url}/v1/cache/${hash}`, {
        method: HttpMethod.Put,
        headers: { Authorization: `Bearer ${server.token}` },
        body,
      }),
  };
}

function publishEvents(events: CacheEvent[]) {
  return events
    .filter((event) => event.operation === 'publish')
    .map((event) => [event.tier, event.bytes, event.errorCode]);
}

const unavailable = () => new ConnectError('unavailable', Code.Unavailable);

test(
  'retry waits do not hold the publication capacity that new writes need',
  { timeout: SHUTDOWN_TEST_TIMEOUT_MS },
  async (context) => {
    const allWaiting = deferred();
    const wake = deferred();
    context.after(() => wake.resolve());
    let sleeping = 0;
    const hashes = Array.from({ length: PUBLICATION_CONCURRENCY + 1 }, (_, index) => `h${index}`);
    const { put } = await retryingServer(context, {
      script: (url) => ({
        create: [
          ...hashes.slice(0, PUBLICATION_CONCURRENCY).map(unavailable),
          ...hashes.map((_, index) => createResponse(`u${index}`, url)),
        ],
        finalize: hashes.map(() => finalizeResponse()),
      }),
      sleep: async () => {
        if (++sleeping === PUBLICATION_CONCURRENCY) {
          allWaiting.resolve();
        }

        await wake.promise;
      },
    });

    for (const hash of hashes.slice(0, PUBLICATION_CONCURRENCY)) {
      assert.equal((await put(hash)).status, 200);
    }
    await allWaiting.promise;

    assert.equal((await put('extra')).status, 200);
  },
);

test(
  'shutdown waits for a retry wait, then records the recovered publication as one success',
  { timeout: SHUTDOWN_TEST_TIMEOUT_MS },
  async (context) => {
    const waiting = deferred();
    const wake = deferred();
    context.after(() => wake.resolve());
    const { server, calls, events, put } = await retryingServer(context, {
      script: (url) => ({
        create: [unavailable(), createResponse('u2', url)],
        finalize: [finalizeResponse()],
      }),
      sleep: async () => {
        waiting.resolve();
        await wake.promise;
      },
    });

    assert.equal((await put('abc', 'archive')).status, 200);
    await waiting.promise;

    let finished = false;
    const running = runCachedCommand(server, process.execPath, ['-e', ''], process.env).then(
      (code) => {
        finished = true;

        return code;
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(finished, false);

    wake.resolve();
    assert.equal(await running, 0);
    assert.equal(calls.create.length, 2);
    assert.deepEqual(publishEvents(events), [['artifact', ARCHIVE_BYTES, undefined]]);
  },
);

test(
  'termination during a retry wait stops retrying and preserves the cancellation status',
  { timeout: SHUTDOWN_TEST_TIMEOUT_MS },
  async (context) => {
    const waiting = deferred();
    const closing = deferred();
    const { server, calls, put } = await retryingServer(context, {
      script: () => ({ create: [unavailable()] }),
      failOpen: true,
      sleep: (_ms, signal) =>
        new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => resolve(), { once: true });
          waiting.resolve();
        }),
    });

    assert.equal((await put('abc', 'archive')).status, 200);
    await waiting.promise;

    let finished = false;
    const running = runCachedCommand(
      {
        ...server,
        close: () => {
          closing.resolve();

          return server.close();
        },
      },
      process.execPath,
      ['-e', ''],
      process.env,
    ).then((code) => {
      finished = true;

      return code;
    });
    await closing.promise;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(finished, false);

    process.emit(ProcessSignal.Terminate);
    assert.equal(await running, TERMINATED_EXIT_CODE);
    assert.equal(calls.create.length, 1);
  },
);

for (const failOpen of [false, true]) {
  test(
    `exhausted retries report one failed publication (${failOpen ? 'fail-open' : 'strict'})`,
    { timeout: SHUTDOWN_TEST_TIMEOUT_MS },
    async (context) => {
      const { server, calls, events, put } = await retryingServer(context, {
        script: () => ({ create: Array.from({ length: EXHAUSTED_ATTEMPTS }, unavailable) }),
        failOpen,
        sleep: async () => {},
      });

      assert.equal((await put('abc', 'archive')).status, 200);

      const code = await runCachedCommand(server, process.execPath, ['-e', ''], process.env, {
        strictPublication: !failOpen,
      });

      assert.equal(code, failOpen ? 0 : 1);
      assert.equal(calls.create.length, EXHAUSTED_ATTEMPTS);
      assert.deepEqual(publishEvents(events), [
        [failOpen ? 'unavailable' : 'error', undefined, 'rpc-14'],
      ]);
    },
  );
}
