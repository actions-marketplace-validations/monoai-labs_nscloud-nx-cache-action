/**
 * Publish the packed CLI package through npm's GitHub trusted publisher.
 * Matching published versions are verified without replacing them; registry
 * failures and conflicting bytes fail the release instead of being ignored.
 *
 * Run: pnpm publish:npm after pnpm build and pnpm package:pack in release CI.
 * Requires npm's publisher configuration and GitHub id-token: write permission.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import projectPackage from '../package.json' with { type: 'json' };
import { execute } from '../src/execute.js';
import { ExitCode } from '../src/process-constants.js';
import { SECOND_MS } from '../src/units.js';

const NPM_DIRECTORY = '.output/npm';
const REGISTRY_TIMEOUT_MS = 30 * SECOND_MS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function matchesPublishedVersion(
  response: Response,
  integrity: string,
): Promise<boolean> {
  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`npm registry lookup failed with HTTP ${response.status}`);
  }

  let metadata: unknown;
  try {
    metadata = await response.json();
  } catch {
    throw new Error('Invalid npm registry metadata');
  }
  if (
    !isRecord(metadata) ||
    !isRecord(metadata.dist) ||
    typeof metadata.dist.integrity !== 'string'
  ) {
    throw new Error('Missing npm package integrity');
  }
  if (metadata.dist.integrity !== integrity) {
    throw new Error('Published npm version differs from the reviewed package');
  }

  return true;
}

async function publish(): Promise<void> {
  const archives = (await readdir(NPM_DIRECTORY)).filter((name) => name.endsWith('.tgz'));
  const archive = archives[0];
  if (!archive || archives.length !== 1) {
    throw new Error('Expected one packed npm archive');
  }
  const file = join(NPM_DIRECTORY, archive);
  const integrity = `sha512-${createHash('sha512')
    .update(await readFile(file))
    .digest('base64')}`;
  const versionUrl = `${projectPackage.publishConfig.registry}/${encodeURIComponent(projectPackage.name)}/${projectPackage.version}`;
  const lookup = () => fetch(versionUrl, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });

  if (await matchesPublishedVersion(await lookup(), integrity)) {
    console.log('Published npm version already matches the reviewed package');
    return;
  }

  const code = await execute('npm', ['publish', file, '--access', 'public'], process.env);
  if (code !== ExitCode.Success) {
    process.exitCode = code;
    return;
  }
  if (!(await matchesPublishedVersion(await lookup(), integrity))) {
    throw new Error('Published npm version is not available for verification');
  }
  console.log('Published npm package integrity verified');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await publish();
}
