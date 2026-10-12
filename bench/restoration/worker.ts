/**
 * Keep the connector's child process alive during controller-driven HTTP restores.
 * The production wrapper ties its listener lifetime to a child command. Ready and
 * stop files let the controller measure that executable and close it deliberately.
 *
 * Started by run.ts with ready/stop paths and the wrapper's listener environment.
 * Writes a private ready file containing listener details; exits when the stop file appears.
 */

import { writeFile, access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { NODE_USER_ARGUMENT_OFFSET } from '../../src/process-constants.js';
import { FilePermissions } from '../../src/filesystem.js';

const STOP_FILE_POLL_INTERVAL_MS = 20;

const [ready, stop] = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
if (
  !ready ||
  !stop ||
  !process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER ||
  !process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
) {
  throw new Error('Missing benchmark listener');
}

await writeFile(
  ready,
  JSON.stringify({
    pid: process.pid,
    url: process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER,
    token: process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN,
  }),
  { mode: FilePermissions.OwnerOnlyFile },
);
while (true) {
  try {
    await access(stop);
    break;
  } catch {}

  await setTimeout(STOP_FILE_POLL_INTERVAL_MS);
}
