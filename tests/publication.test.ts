import { test } from 'node:test';
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
