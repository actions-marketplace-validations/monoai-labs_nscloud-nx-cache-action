/**
 * Verify real Nx builds and restores through the packaged connector executable.
 * This checks that the distributed bundle preserves outputs and avoids re-running
 * tasks on local hits, plus Artifact hits when NX_ARTIFACT_PREFIX is supplied.
 *
 * Run: pnpm exec tsx scripts/bundle-proof.ts after pnpm build and fixture setup.
 * Needs: the installed integration workspace; credentials for remote checks.
 * Writes: results/bundle-*.log and results/bundle-proof.json.
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  clearProjectOutputs,
  outputDigests,
  INTEGRATION_BUILD_TIMEOUT_MS,
  INTEGRATION_OUTPUT_LIMIT_BYTES,
} from './integration-workspace.js';
import { CacheFailureMode } from '../src/config.js';

const exec = promisify(execFile);
const root = resolve('fixtures/integration/workspace');
const bundle = resolve('.output/release/nscloud-nx-cache-action.mjs');
const archive = await mkdtemp(join(process.env.NX_ARCHIVE_DIRECTORY ?? tmpdir(), 'bundle-proof-'));
const results: { label: string; executions: number; digests: Record<string, string> }[] = [];

async function build(label: string) {
  await clearProjectOutputs(root);
  await rm(join(root, 'executions.jsonl'), { force: true });

  const run = await exec(
    process.execPath,
    [bundle, 'pnpm', 'exec', 'nx', 'run-many', '-t', 'build', '--parallel=2'],
    {
      cwd: root,
      env: {
        ...process.env,
        NX_ARCHIVE_DIRECTORY: archive,
        NX_CACHE_FAILURE_MODE: CacheFailureMode.Strict,
        NX_NO_CLOUD: 'true',
        CI: 'true',
      },
      timeout: INTEGRATION_BUILD_TIMEOUT_MS,
      maxBuffer: INTEGRATION_OUTPUT_LIMIT_BYTES,
    },
  );

  let executions = 0;
  try {
    executions = (await readFile(join(root, 'executions.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean).length;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const digests = await outputDigests(root);
  results.push({ label, executions, digests });
  await writeFile(`results/bundle-${label}.log`, run.stdout + run.stderr);

  return { executions, digests };
}

try {
  await mkdir('results', { recursive: true });

  const cold = await build('cold');
  assert.equal(cold.executions, 8);

  const warm = await build('local');
  assert.equal(warm.executions, 0);
  assert.deepEqual(warm.digests, cold.digests);

  if (process.env.NX_ARTIFACT_PREFIX) {
    await rm(join(archive, 'entries-v1'), { recursive: true, force: true });

    const shared = await build('artifact');
    assert.equal(shared.executions, 0);
    assert.deepEqual(shared.digests, cold.digests);
  }

  await writeFile('results/bundle-proof.json', JSON.stringify(results, null, 2));

  console.log(JSON.stringify(results.map(({ label, executions }) => ({ label, executions }))));
} finally {
  await rm(archive, { recursive: true, force: true });
}
