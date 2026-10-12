/**
 * Verify Nx invalidation and failed-task contracts against the local cache server.
 * Controlled changes to source, codegen, dependencies, lockfiles and environment
 * prove that the connector preserves Nx's decisions about which tasks must run.
 * Package paths refer to the generated @fixture/* workspace: app is its leaf
 * consumer, ui is a source-only library, and contracts exercises code generation.
 *
 * Run: pnpm integration:contracts after generating and installing the fixture.
 * Temporarily mutates that workspace and resets .output/contracts/.
 * Writes: results/contracts-nx.json.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/local-store.js';
import { startServer } from '../src/server.js';
import {
  clearProjectOutputs,
  INTEGRATION_BUILD_TIMEOUT_MS,
  INTEGRATION_OUTPUT_LIMIT_BYTES,
} from './integration-workspace.js';

const exec = promisify(execFile);
const root = resolve('fixtures/integration/workspace');
const server = await startServer({
  local: new LocalStore(resolve('.output/contracts')),
  record: () => {},
});
const env = {
  ...process.env,
  CI: 'true',
  NX_DAEMON: 'false',
  NX_NO_CLOUD: 'true',
  NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
  NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
  NX_SELF_HOSTED_REMOTE_CACHE_SERVER: server.url,
  NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: server.token,
};
const evidence: unknown[] = [];

async function clear() {
  await rm(join(root, '.nx'), { recursive: true, force: true });
  await rm(join(root, 'executions.jsonl'), { force: true });
  await clearProjectOutputs(root);
}

async function build(extra: NodeJS.ProcessEnv = {}) {
  await clear();
  const command = ['exec', 'nx', 'run-many', '-t', 'build', '--parallel=2'];
  await exec('pnpm', command, {
    cwd: root,
    env: { ...env, ...extra },
    timeout: INTEGRATION_BUILD_TIMEOUT_MS,
    maxBuffer: INTEGRATION_OUTPUT_LIMIT_BYTES,
  });

  let lines = '';
  try {
    lines = await readFile(join(root, 'executions.jsonl'), 'utf8');
  } catch {}

  return lines
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const row = JSON.parse(line);
      return `${row.project}:${row.task}`;
    })
    .sort();
}

async function mutation(
  label: string,
  file: string,
  transform: (value: string) => string,
  expected: string[],
) {
  const full = join(root, file);
  const before = await readFile(full, 'utf8');
  await build();

  try {
    await writeFile(full, transform(before));
    const actual = await build();
    assert.deepEqual(actual, [...expected].sort(), label);
    evidence.push({ label, actual });
  } finally {
    await writeFile(full, before);
  }
}

try {
  await rm(resolve('.output/contracts'), { recursive: true, force: true });

  const cold = await build();
  assert.equal(cold.length, 8);
  evidence.push({ label: 'cold', actual: cold });

  assert.deepEqual(await build(), []);

  await mutation('leaf', 'packages/app/src/index.ts', (s) => s + '\n// leaf mutation\n', [
    'app:build',
  ]);

  await mutation(
    'source-only-library',
    'packages/ui/src/index.ts',
    (s) => s + '\n// source mutation\n',
    ['left:build', 'diamond:build', 'app:build'],
  );

  await mutation(
    'generated',
    'scripts/generate.mjs',
    (s) => s.replace('schemaVersion = 1', 'schemaVersion = 2'),
    ['contracts:generate', 'contracts:build', 'app:build'],
  );

  await mutation('root-build', 'scripts/build.mjs', (s) => s + '\n// build tool mutation\n', [
    'base:build',
    'left:build',
    'right:build',
    'diamond:build',
    'contracts:build',
    'app:build',
    'independent:build',
  ]);

  await mutation(
    'dependency-edge',
    'packages/left/package.json',
    (s) => {
      const p = JSON.parse(s);
      p.dependencies['@fixture/independent'] = 'workspace:*';
      return JSON.stringify(p);
    },
    ['left:build', 'diamond:build', 'app:build'],
  );

  await build();
  const manifestFile = join(root, 'package.json');
  const lockFile = join(root, 'pnpm-lock.yaml');
  const manifestBefore = await readFile(manifestFile, 'utf8');
  const lockBefore = await readFile(lockFile, 'utf8');
  try {
    const manifest = JSON.parse(manifestBefore);
    manifest.devDependencies.esbuild = '0.28.1';
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    await exec('pnpm', ['install', '--no-frozen-lockfile'], {
      cwd: root,
      env,
      timeout: INTEGRATION_BUILD_TIMEOUT_MS,
    });

    const actual = await build();
    for (const name of ['base', 'left', 'right', 'diamond', 'contracts', 'app', 'independent']) {
      assert(actual.includes(`${name}:build`), `external dependency failed to invalidate ${name}`);
    }

    evidence.push({ label: 'external-dependency-lockfile', actual });
  } finally {
    await writeFile(manifestFile, manifestBefore);
    await writeFile(lockFile, lockBefore);
    await exec('pnpm', ['install', '--frozen-lockfile'], {
      cwd: root,
      env,
      timeout: INTEGRATION_BUILD_TIMEOUT_MS,
    });
  }

  await build();
  const environment = await build({ BUILD_MODE: 'variant' });
  assert.equal(environment.length, 7);
  evidence.push({ label: 'environment', actual: environment });

  await build();
  await writeFile(join(root, 'README.md'), 'unrelated documentation');
  assert.deepEqual(await build(), []);
  await rm(join(root, 'README.md'));

  const file = join(root, 'packages/app/src/index.ts');
  const source = await readFile(file, 'utf8');
  try {
    await writeFile(file, source + '\ninvalid syntax ???\n');
    await assert.rejects(build());
    await assert.rejects(build());
    evidence.push({ label: 'failed-task-not-reused', attempts: 2 });
  } finally {
    await writeFile(file, source);
  }

  await mkdir('results', { recursive: true });
  await writeFile('results/contracts-nx.json', JSON.stringify(evidence, null, 2));

  console.log(JSON.stringify(evidence));
} finally {
  await server.close();
}
