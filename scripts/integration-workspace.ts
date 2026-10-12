/**
 * Share project-output cleanup and digest checks across the integration proofs.
 * Removing generated outputs forces a restore, and matching digests verifies its
 * contents. Keeping these operations together makes all three proofs inspect
 * the same fixture outputs while leaving cache and archive cleanup to callers.
 *
 * Imported by the integration scripts; callers supply their generated workspace.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MINUTE_MS } from '../src/units.js';

export const INTEGRATION_BUILD_TIMEOUT_MS = 2 * MINUTE_MS;
export const INTEGRATION_OUTPUT_LIMIT_BYTES = 4_000_000;

export async function clearProjectOutputs(workspace: string): Promise<void> {
  for (const name of await readdir(join(workspace, 'packages'))) {
    await rm(join(workspace, 'packages', name, 'dist'), { recursive: true, force: true });
    await rm(join(workspace, 'packages', name, '.generated'), { recursive: true, force: true });
  }
}

export async function outputDigests(workspace: string): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const name of await readdir(join(workspace, 'packages'))) {
    if (name === 'ui') {
      continue;
    }

    const output = await readFile(join(workspace, 'packages', name, 'dist/index.js'));
    digests[name] = createHash('sha256').update(output).digest('hex');
  }

  return digests;
}
