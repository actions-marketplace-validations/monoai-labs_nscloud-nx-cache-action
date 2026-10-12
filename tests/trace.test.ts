import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CacheTrace, type TraceEvent } from '../src/trace.js';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import { SECOND_MS } from '../src/units.js';

const SLOW_TRACE_WORK_MS = 10;
const FAST_TRACE_WORK_MS = 1;
const TRACE_REQUEST_TIMEOUT_MS = 5 * SECOND_MS;

test('trace contexts remain independent across concurrent requests and finish once', async () => {
  const events: TraceEvent[] = [];
  const trace = new CacheTrace((event) => events.push(event));
  assert.equal(trace.begin('local.verify'), undefined);

  await Promise.all(
    ['one', 'two'].map((hash) =>
      trace.request(hash, async () => {
        const finish = trace.begin('local.verify');

        await new Promise((resolve) =>
          setTimeout(resolve, hash === 'one' ? SLOW_TRACE_WORK_MS : FAST_TRACE_WORK_MS),
        );
        finish?.({ bytes: 17 });
        finish?.({ bytes: 99 });
      }),
    ),
  );

  for (const hash of ['one', 'two']) {
    const group = events.filter((event) => event.hash === hash);
    assert.equal(new Set(group.map((event) => event.requestId)).size, 1);
    assert.equal(group.filter((event) => event.stage === 'local.verify').length, 1);
    assert.equal(group.find((event) => event.stage === 'local.verify')?.counters?.bytes, 17);
    assert(group.every((event) => event.durationMs >= 0 && event.startMs >= 0));
    assert.equal(group[0]?.stage, 'request.start');
    assert.equal(group.at(-1)?.stage, 'request');
  }

  assert.equal(new Set(events.map((event) => event.requestId)).size, 2);
  assert.equal(trace.begin('local.verify'), undefined);

  await assert.rejects(
    trace.request('https://private', async () => {}),
    /Invalid trace identity/,
  );
});

test('traced remote persistence and local restoration preserve bodies and tier contracts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-trace-contract-'));
  const events: TraceEvent[] = [];
  const trace = new CacheTrace((event) => events.push(event));
  const local = new LocalStore(directory, { trace });
  const server = await startServer({
    local,
    trace,
    readOnly: true,
    record: () => {},
    remote: {
      async get() {
        return (async function* () {
          yield Buffer.from('synthetic');
        })();
      },
      async put() {
        throw new Error('unexpected publication');
      },
    },
  });

  try {
    for (let index = 0; index < 2; index++) {
      assert.equal(
        await (
          await fetch(`${server.url}/v1/cache/synthetic`, {
            headers: { authorization: `Bearer ${server.token}` },
            signal: AbortSignal.timeout(TRACE_REQUEST_TIMEOUT_MS),
          })
        ).text(),
        'synthetic',
      );
    }
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }

  assert.equal(events.filter((event) => event.stage === 'request').length, 2);

  for (const stage of [
    'disk.scan',
    'local.write',
    'local.fsync',
    'local.metadata-fsync',
    'local.commit',
    'local.verify',
    'response.stream',
  ]) {
    assert(events.some((event) => event.stage === stage));
  }

  assert(!JSON.stringify(events).includes(server.token));
  assert(!JSON.stringify(events).includes(directory));
  assert(!JSON.stringify(events).includes(server.url));
});
