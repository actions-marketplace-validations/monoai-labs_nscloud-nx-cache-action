import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildDistributions } from './helpers.js';

const exec = promisify(execFile);

test('action setup exports bounded single-line values and launcher forwards task arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-action-'));

  try {
    await buildDistributions(directory);

    const env = {
      ...process.env,
      GITHUB_ACTION_PATH: directory,
      GITHUB_PATH: join(directory, 'path'),
      GITHUB_ENV: join(directory, 'env'),
      INPUT_ARTIFACT_PREFIX: 'nx/v1/test',
      INPUT_ACCESS: 'read-only',
    };

    await exec(process.execPath, [join(directory, 'dist/setup.mjs')], { env });
    assert.match(await readFile(join(directory, 'env'), 'utf8'), /NX_CACHE_ACCESS=read-only/);

    const launcher = join(
      (await readFile(join(directory, 'path'), 'utf8')).trim(),
      'nscloud-nx-cache-action',
    );
    const result = await exec(
      process.execPath,
      [launcher, process.execPath, '-e', 'console.log(process.argv[1])', 'literal $HOME'],
      { env: { ...process.env, NX_ARCHIVE_DIRECTORY: join(directory, 'archives') } },
    );
    assert.equal(result.stdout.trim(), 'literal $HOME');

    await assert.rejects(
      exec(process.execPath, [join(directory, 'dist/setup.mjs')], {
        env: { ...env, INPUT_ARTIFACT_PREFIX: 'bad\nINJECTED=true' },
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
