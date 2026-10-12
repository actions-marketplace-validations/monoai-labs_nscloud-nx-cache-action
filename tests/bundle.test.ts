import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { SECOND_MS } from '../src/units.js';
import { buildDistributions } from './helpers.js';

const BUNDLE_EXECUTION_TIMEOUT_MS = 10 * SECOND_MS;

const exec = promisify(execFile);

test('bundle is reproducible and runs without node_modules while preserving task failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-bundle-'));
  const releaseDirectory = join(directory, '.output', 'release');

  try {
    await buildDistributions(directory);
    const first = await readFile(join(releaseDirectory, 'SHA256SUMS'), 'utf8');

    await buildDistributions(directory);
    assert.equal(await readFile(join(releaseDirectory, 'SHA256SUMS'), 'utf8'), first);

    const assets = first
      .trim()
      .split('\n')
      .map((line) => line.split('  '));
    assert.deepEqual(
      assets.map(([, name]) => name),
      ['nscloud-nx-cache-action.mjs', 'token.mjs', 'LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.txt'],
    );

    for (const [digest, name] of assets) {
      assert(name);
      assert.equal(
        createHash('sha256')
          .update(await readFile(join(releaseDirectory, name)))
          .digest('hex'),
        digest,
      );
    }

    for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.txt']) {
      assert.deepEqual(await readFile(join(releaseDirectory, name)), await readFile(name));
    }

    const bundle = join(directory, 'cache.mjs');
    await copyFile(join(releaseDirectory, 'nscloud-nx-cache-action.mjs'), bundle);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NX_ARCHIVE_DIRECTORY: join(directory, 'archives'),
    };
    delete env.NX_ARTIFACT_PREFIX;

    await assert.rejects(
      exec(process.execPath, [bundle, process.execPath, '-e', 'process.exit(7)'], {
        cwd: directory,
        env,
        timeout: BUNDLE_EXECUTION_TIMEOUT_MS,
      }),
      (error) => error instanceof Error && 'code' in error && error.code === 7,
    );

    const success = await exec(
      process.execPath,
      [bundle, process.execPath, '-e', 'console.log("bundle ran")'],
      {
        cwd: directory,
        env,
        timeout: BUNDLE_EXECUTION_TIMEOUT_MS,
      },
    );
    assert.equal(success.stdout.trim(), 'bundle ran');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
