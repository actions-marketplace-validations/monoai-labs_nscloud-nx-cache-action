import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { runWithCache } from '../src/command.js';
import { withTemporaryDirectory as sandbox } from './helpers.js';

test('startup outage bypasses caching and preserves a failing command', async () =>
  sandbox(async (directory) => {
    const output = join(directory, 'environment.json');
    const source = `require('node:fs').writeFileSync(${JSON.stringify(output)},JSON.stringify(Object.fromEntries(['NX_SKIP_NX_CACHE','NX_DAEMON','NX_WORKSPACE_DATA_DIRECTORY','NX_SELF_HOSTED_REMOTE_CACHE_SERVER','NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN'].map(key=>[key,process.env[key]]))));process.exit(7)`;
    const code = await runWithCache(
      process.execPath,
      ['-e', source],
      {
        ...process.env,
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: 'http://invalid.example',
        NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'do-not-forward',
      },
      async () => {
        throw new Error('offline');
      },
      false,
    );
    assert.equal(code, 7);

    const env = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(env.NX_SKIP_NX_CACHE, 'true');
    assert.equal(env.NX_DAEMON, 'false');
    assert.equal(env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER, undefined);
    assert.equal(env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN, undefined);
    await assert.rejects(access(dirname(env.NX_WORKSPACE_DATA_DIRECTORY)));
  }));

test('strict startup failure does not execute the command', async () =>
  sandbox(async (directory) => {
    const output = join(directory, 'ran');
    const code = await runWithCache(
      process.execPath,
      ['-e', `require('node:fs').writeFileSync(${JSON.stringify(output)},'ran')`],
      process.env,
      async () => {
        throw new Error('offline');
      },
    );
    assert.equal(code, 1);
    await assert.rejects(access(output));
  }));

test('commands get distinct metadata directories and publication failure can fail open', async () =>
  sandbox(async (directory) => {
    const outputs: string[] = [];
    for (let index = 0; index < 2; index++) {
      const output = join(directory, String(index));
      const source = `require('node:fs').writeFileSync(${JSON.stringify(output)},process.env.NX_WORKSPACE_DATA_DIRECTORY)`;
      const code = await runWithCache(
        process.execPath,
        ['-e', source],
        process.env,
        async () => ({
          url: 'http://127.0.0.1',
          token: 'test',
          close: async () => {
            throw new Error('offline');
          },
        }),
        false,
      );
      assert.equal(code, 0);

      const metadata = await readFile(output, 'utf8');
      outputs.push(metadata);

      await assert.rejects(access(dirname(metadata)));
    }

    assert.notEqual(outputs[0], outputs[1]);
  }));
