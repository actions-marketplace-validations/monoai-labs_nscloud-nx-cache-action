import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startConfiguredServer } from '../src/runtime.js';
import { LocalStore } from '../src/local-store.js';
import type { RemoteStore } from '../src/artifact-store.js';
import type { CacheEvent } from '../src/metrics.js';
import { chunks, withTemporaryDirectory as sandbox } from './helpers.js';
import { HttpMethod } from '../src/http.js';
import { CacheTier, CacheOperation } from '../src/metrics.js';

test('remote read-only accepts local writes, reads remote, and skips publication', () =>
  sandbox(async (directory) => {
    const events: CacheEvent[] = [];
    let lookups = 0;
    let publications = 0;
    const remote: RemoteStore = {
      async get() {
        lookups++;

        return chunks('remote-archive');
      },
      async put() {
        publications++;

        return true;
      },
    };

    const server = await startConfiguredServer(
      {
        NX_ARCHIVE_DIRECTORY: directory,
        NX_ARTIFACT_PREFIX: 'test/prefix',
        NX_CACHE_REMOTE_ACCESS: 'read-only',
      },
      (event) => events.push(event),
      async () => remote,
    );
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      assert.equal(
        (
          await fetch(`${server.url}/v1/cache/local`, {
            method: HttpMethod.Put,
            headers,
            body: 'local-archive',
          })
        ).status,
        200,
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/local`, { headers })).text(),
        'local-archive',
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/fromremote`, { headers })).text(),
        'remote-archive',
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/fromremote`, { headers })).text(),
        'remote-archive',
      );
      assert.equal(lookups, 1);
      assert.equal(publications, 0);
      assert.equal(events.filter((event) => event.tier === CacheTier.Policy).length, 1);
      assert.equal(
        events.filter(
          (event) => event.operation === CacheOperation.Put && event.tier === CacheTier.Local,
        ).length,
        1,
      );
    } finally {
      await server.close();
    }
  }));

test('remote startup failure retains local caching in fail-open mode', () =>
  sandbox(async (directory) => {
    const events: CacheEvent[] = [];
    const server = await startConfiguredServer(
      { NX_ARCHIVE_DIRECTORY: directory, NX_ARTIFACT_PREFIX: 'test/prefix' },
      (event) => events.push(event),
      async () => {
        throw new Error('unavailable');
      },
    );
    const headers = { authorization: `Bearer ${server.token}` };

    try {
      assert.equal(
        (
          await fetch(`${server.url}/v1/cache/local`, {
            method: HttpMethod.Put,
            headers,
            body: 'archive',
          })
        ).status,
        200,
      );

      assert.equal(
        await (await fetch(`${server.url}/v1/cache/local`, { headers })).text(),
        'archive',
      );
      assert.equal(
        await readFile((await new LocalStore(directory).get('local')) ?? '', 'utf8'),
        'archive',
      );
      assert.equal(events.filter((event) => event.tier === CacheTier.Unavailable).length, 1);
    } finally {
      await server.close();
    }
  }));

test('strict remote setup failure rejects startup', () =>
  sandbox(async (directory) => {
    await assert.rejects(
      startConfiguredServer(
        {
          NX_ARCHIVE_DIRECTORY: directory,
          NX_ARTIFACT_PREFIX: 'test/prefix',
          NX_CACHE_FAILURE_MODE: 'strict',
        },
        () => {},
        async () => {
          throw new Error('unavailable');
        },
      ),
    );
  }));

test('strict remote lookup failure is visible after startup', () =>
  sandbox(async (directory) => {
    const remote: RemoteStore = {
      async get() {
        throw new Error('unavailable');
      },
      async put() {
        return true;
      },
    };
    const server = await startConfiguredServer(
      {
        NX_ARCHIVE_DIRECTORY: directory,
        NX_ARTIFACT_PREFIX: 'test/prefix',
        NX_CACHE_FAILURE_MODE: 'strict',
      },
      () => {},
      async () => remote,
    );

    try {
      const response = await fetch(`${server.url}/v1/cache/absent`, {
        headers: { authorization: `Bearer ${server.token}` },
      });
      assert.equal(response.status, 500);
    } finally {
      await server.close();
    }
  }));

test('without an Artifact prefix the remote factory is never called', () =>
  sandbox(async (directory) => {
    const server = await startConfiguredServer(
      { NX_ARCHIVE_DIRECTORY: directory },
      () => {},
      async () => {
        throw new Error('unexpected remote setup');
      },
    );

    try {
      const response = await fetch(`${server.url}/v1/cache/absent`, {
        headers: { authorization: `Bearer ${server.token}` },
      });
      assert.equal(response.status, 404);
    } finally {
      await server.close();
    }
  }));

test('legacy read-only remains stricter than remote read-only', () =>
  sandbox(async (directory) => {
    const server = await startConfiguredServer(
      {
        NX_ARCHIVE_DIRECTORY: directory,
        NX_CACHE_ACCESS: 'read-only',
        NX_CACHE_REMOTE_ACCESS: 'read-only',
      },
      () => {},
    );

    try {
      const response = await fetch(`${server.url}/v1/cache/local`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'archive',
      });
      assert.equal(response.status, 403);
    } finally {
      await server.close();
    }
  }));

test('default remote access still publishes', () =>
  sandbox(async (directory) => {
    let count = 0;
    const remote: RemoteStore = {
      async get() {
        return null;
      },
      async put() {
        count++;

        return true;
      },
    };
    const server = await startConfiguredServer(
      { NX_ARCHIVE_DIRECTORY: directory, NX_ARTIFACT_PREFIX: 'test/prefix' },
      () => {},
      async () => remote,
    );

    try {
      const response = await fetch(`${server.url}/v1/cache/local`, {
        method: HttpMethod.Put,
        headers: { authorization: `Bearer ${server.token}` },
        body: 'archive',
      });
      assert.equal(response.status, 200);
    } finally {
      await server.close();
    }

    assert.equal(count, 1);
  }));

test('invalid remote access setting is rejected', () =>
  sandbox(async (directory) => {
    await assert.rejects(
      startConfiguredServer(
        { NX_ARCHIVE_DIRECTORY: directory, NX_CACHE_REMOTE_ACCESS: 'unknown' },
        () => {},
      ),
      /Invalid remote cache access/,
    );
  }));
