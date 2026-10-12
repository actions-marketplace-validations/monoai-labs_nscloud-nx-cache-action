import { FilePermissions } from './filesystem.js';
import { CacheAccess, CacheFailureMode, DEFAULT_ARTIFACT_REGION } from './config.js';
import { appendFile, mkdir, writeFile, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const HOME_DIRECTORY_PREFIX = '~/';

const action = process.env.GITHUB_ACTION_PATH;
const githubPath = process.env.GITHUB_PATH;
const githubEnv = process.env.GITHUB_ENV;
if (!action || !githubPath || !githubEnv) {
  throw new Error('Expected GitHub Actions environment');
}

const rawDirectory = process.env.INPUT_ARCHIVE_DIRECTORY ?? '~/.cache/nx-namespace';
const directory = resolve(
  rawDirectory.startsWith(HOME_DIRECTORY_PREFIX)
    ? join(homedir(), rawDirectory.slice(HOME_DIRECTORY_PREFIX.length))
    : rawDirectory,
);
const values = {
  NX_ARCHIVE_DIRECTORY: directory,
  NX_ARTIFACT_PREFIX: process.env.INPUT_ARTIFACT_PREFIX ?? '',
  NX_ARTIFACT_REGION: process.env.INPUT_ARTIFACT_REGION ?? DEFAULT_ARTIFACT_REGION,
  NX_CACHE_ACCESS: process.env.INPUT_ACCESS ?? CacheAccess.ReadOnly,
  NX_CACHE_FAILURE_MODE: CacheFailureMode.FailOpen,
};
for (const value of Object.values(values)) {
  if (/[\r\n]/.test(value)) {
    throw new Error('Invalid multiline action input');
  }
}

const bin = join(action, '.output', 'bin');
const distribution = join(action, 'dist');
await mkdir(bin, { recursive: true });

async function writeLauncher(name: string, bundle: string): Promise<void> {
  const launcher = join(bin, name);
  // JSON encoding creates JavaScript literals, never shell command fragments.
  await writeFile(
    launcher,
    `#!/usr/bin/env node\nimport(${JSON.stringify(join(distribution, bundle))});\n`,
    { mode: FilePermissions.Executable },
  );
  await chmod(launcher, FilePermissions.Executable);
}

await writeLauncher('nscloud-nx-cache-action', 'nscloud-nx-cache-action.mjs');
await writeLauncher('nx-namespace-token', 'token.mjs');

await appendFile(githubPath, `${bin}\n`);
await appendFile(
  githubEnv,
  Object.entries(values)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(''),
);
