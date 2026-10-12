import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function buildDistributions(directory: string): Promise<void> {
  await exec(process.execPath, ['--import', 'tsx', 'scripts/build.ts', directory]);
}

export async function withTemporaryDirectory(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'nx-cache-test-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function* chunks(value: string | Uint8Array) {
  yield typeof value === 'string' ? Buffer.from(value) : value;
}

export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
