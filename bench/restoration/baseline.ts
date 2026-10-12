/**
 * Download a benchmark reference from an explicitly selected immutable commit.
 * Comparisons record the commit and bundle digest so results identify the exact
 * code measured without depending on another repository's development history.
 *
 * Run: BENCH_BASELINE_REVISION=<full-commit-sha> pnpm exec tsx bench/restoration/baseline.ts.
 * Needs: GitHub CLI access; BENCH_REFERENCE_REPOSITORY optionally selects a fork.
 * Writes: .output/benchmark-baseline/ with the executable and its SHA-256 checksum.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sha256 } from './fixture.js';
import { referenceRepository } from './reference-repository.js';
import { FilePermissions } from '../../src/filesystem.js';

const BUNDLE_NAME = 'nscloud-nx-cache-action.mjs';
const revision = process.env.BENCH_BASELINE_REVISION;
if (!revision || !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error('BENCH_BASELINE_REVISION must be a full commit SHA');
}

const response = execFileSync(
  'gh',
  ['api', `repos/${referenceRepository()}/contents/dist/${BUNDLE_NAME}?ref=${revision}`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
const object = JSON.parse(response);
if (object.encoding !== 'base64' || typeof object.content !== 'string') {
  throw new Error('Invalid baseline response');
}

const bytes = Buffer.from(object.content, 'base64');
const digest = sha256(bytes);
const directory = resolve('.output/benchmark-baseline');
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, BUNDLE_NAME), bytes, { mode: FilePermissions.Executable });
await writeFile(resolve(directory, 'SHA256SUMS'), `${digest}  ${BUNDLE_NAME}\n`);

console.log(JSON.stringify({ revision, digest }));
