/**
 * Verify real Nx output restoration through the connector's server API.
 * Comparing output digests and task execution counts proves reuse after deleting
 * Nx state and outputs, including a fresh local store backed by Artifact Storage.
 *
 * Run: pnpm integration:restoration after generating and installing the fixture.
 * Use a dedicated NX_ARCHIVE_DIRECTORY; NX_ARTIFACT_PREFIX enables remote checks
 * and requires Namespace credentials. Writes logs and restoration evidence to results/.
 */

import type { CacheEvent } from '../src/metrics.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/local-store.js';
import { createArtifactStore } from '../src/artifact-store.js';
import { DEFAULT_ARTIFACT_REGION } from '../src/config.js';
import { startServer } from '../src/server.js';
import {
  clearProjectOutputs,
  outputDigests,
  INTEGRATION_BUILD_TIMEOUT_MS,
  INTEGRATION_OUTPUT_LIMIT_BYTES,
} from './integration-workspace.js';
import { CacheTier, CacheOperation } from '../src/metrics.js';

const exec = promisify(execFile);
const root = resolve('fixtures/integration/workspace');
const archive = resolve(process.env.NX_ARCHIVE_DIRECTORY ?? '.output/archives');
const prefix = process.env.NX_ARTIFACT_PREFIX;
const remote = prefix
  ? await createArtifactStore(prefix, process.env.NX_ARTIFACT_REGION ?? DEFAULT_ARTIFACT_REGION)
  : undefined;

const events: CacheEvent[] = [];
const server = await startServer({
  local: new LocalStore(archive),
  ...(remote ? { remote } : {}),
  record: (event) => events.push(event),
});
const env = {
  ...process.env,
  NX_DAEMON: 'false',
  NX_NO_CLOUD: 'true',
  NX_INTERACTIVE: 'false',
  CI: 'true',
  NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
  NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
  NX_SELF_HOSTED_REMOTE_CACHE_SERVER: server.url,
  NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: server.token,
};

async function clearOutputs() {
  await clearProjectOutputs(root);
  await rm(join(root, '.nx'), { recursive: true, force: true });
  await rm(join(root, 'executions.jsonl'), { force: true });
}

async function runs() {
  try {
    return (await readFile(join(root, 'executions.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function build(label: string) {
  const run = await exec('pnpm', ['exec', 'nx', 'run-many', '-t', 'build', '--parallel=2'], {
    cwd: root,
    env,
    timeout: INTEGRATION_BUILD_TIMEOUT_MS,
    maxBuffer: INTEGRATION_OUTPUT_LIMIT_BYTES,
  });
  await mkdir('results', { recursive: true });
  await writeFile(`results/${label}.log`, run.stdout + run.stderr);

  return {
    label,
    digests: await outputDigests(root),
    executions: await runs(),
    events: [...events],
  };
}

try {
  await clearOutputs();
  const first = await build('first');
  if (process.env.INTEGRATION_EXPECT_REUSE === 'true') {
    assert.equal(first.executions.length, 0, 'Fresh consumer unexpectedly rebuilt');
  }
  if (process.env.INTEGRATION_EXPECT_COLD === 'true') {
    assert.equal(first.executions.length, 8, 'Cold producer unexpectedly reused cache');
  }

  await clearOutputs();
  events.length = 0;
  const local = await build('local-restore');
  assert.deepEqual(local.digests, first.digests);
  assert.equal(local.executions.length, 0);
  assert(events.some((event) => event.tier === CacheTier.Local));

  const results = [first, local];
  if (remote) {
    await rm(archive, { recursive: true, force: true });
    await clearOutputs();
    events.length = 0;
    const shared = await build('artifact-restore');
    assert.deepEqual(shared.digests, first.digests);
    assert.equal(shared.executions.length, 0);
    assert(events.some((event) => event.tier === CacheTier.Artifact));
    results.push(shared);
  }

  await writeFile(
    'results/integration-restoration.json',
    JSON.stringify({ node: process.version, remote: Boolean(remote), results }, null, 2),
  );

  console.log(
    JSON.stringify({
      remote: Boolean(remote),
      runs: results.map((r) => ({
        label: r.label,
        executions: r.executions.length,
        hits: r.events.filter((e) => e.operation === CacheOperation.Get).map((e) => e.tier),
      })),
    }),
  );
} finally {
  await server.close();
}
