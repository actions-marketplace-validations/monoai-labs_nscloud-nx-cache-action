/**
 * Build the standalone cache connector, credential CLI and GitHub Action setup.
 * Bundling lets consumers run without this checkout or its dependencies; release
 * assets also need the license notices and checksums alongside the executables.
 *
 * Run: pnpm build [output-root] from the repository root.
 * Writes: dist/ and .output/release/ under output-root (default: this checkout).
 * Creates: .output/npm/ for the separately packed npm distribution.
 * Tests supply their own output root so concurrent builds do not share files.
 */

import type { BuildOptions } from 'esbuild';
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FilePermissions } from '../src/filesystem.js';
import { NODE_USER_ARGUMENT_OFFSET } from '../src/process-constants.js';
import { join } from 'node:path';

const name = 'nscloud-nx-cache-action.mjs';
const outputRoot = process.argv[NODE_USER_ARGUMENT_OFFSET] ?? '.';
const releaseDirectory = join(outputRoot, '.output', 'release');
const distributionDirectory = join(outputRoot, 'dist');

const bundleOptions: BuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  keepNames: true,
  legalComments: 'inline',
};

const executableBanner = {
  js: [
    '#!/usr/bin/env node',
    "import { createRequire as bundleCreateRequire } from 'node:module';",
    'const require = bundleCreateRequire(import.meta.url);',
  ].join('\n'),
};

const result = await build({
  ...bundleOptions,
  entryPoints: ['src/run.ts'],
  write: false,
  banner: executableBanner,
});

const output = result.outputFiles[0];
if (!output || result.outputFiles.length !== 1) {
  throw new Error('Expected one executable bundle');
}

await mkdir(releaseDirectory, { recursive: true });
await mkdir(join(outputRoot, '.output', 'npm'), { recursive: true });
await writeFile(join(releaseDirectory, name), output.contents, {
  mode: FilePermissions.Executable,
});
await mkdir(distributionDirectory, { recursive: true });
await writeFile(join(distributionDirectory, name), output.contents, {
  mode: FilePermissions.Executable,
});
await build({
  ...bundleOptions,
  entryPoints: ['src/setup.ts'],
  outfile: join(distributionDirectory, 'setup.mjs'),
});

await build({
  ...bundleOptions,
  entryPoints: ['src/token-command.ts'],
  outfile: join(distributionDirectory, 'token.mjs'),
  banner: executableBanner,
});

await copyFile(join(distributionDirectory, 'token.mjs'), join(releaseDirectory, 'token.mjs'));
const notices = ['LICENSE', 'NOTICE', 'THIRD_PARTY_LICENSES.txt'];
for (const notice of notices) {
  await copyFile(notice, join(releaseDirectory, notice));
}

const checksums = [];
for (const asset of [name, 'token.mjs', ...notices]) {
  const bytes = await readFile(join(releaseDirectory, asset));
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${asset}\n`);
}

await writeFile(join(releaseDirectory, 'SHA256SUMS'), checksums.join(''));
