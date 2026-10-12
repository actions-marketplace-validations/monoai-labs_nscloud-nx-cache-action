/**
 * Create calibrated synthetic archives using Nx's native serializer.
 * Anonymous corpus shapes preserve directory topology, modes, file sizes and
 * compression characteristics for restoration measurements without copying
 * private source paths or contents. Calibration checks the generated archives.
 *
 * Run: pnpm exec tsx bench/restoration/fixture.ts [directory] [--all].
 * Writes: archives and manifests under .output/restoration-corpus/ by default.
 */

import type {
  RestorationCorpus,
  FixtureProfile,
  ArchiveLayoutEntry,
  RestorationProfile,
  GeneratedCorpus,
  GeneratedFixture,
} from './profile-types.js';

import { isDeepStrictEqual } from 'node:util';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, utimes } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { profileArchive } from './profile.js';
import { withArchiveSerializer } from './archive-serializer.js';
import { TarEntryType, OCTAL_RADIX } from './tar-format.js';
import { FilePermissions } from '../../src/filesystem.js';
import { NODE_USER_ARGUMENT_OFFSET } from '../../src/process-constants.js';

const CALIBRATION_SEARCH_TRIALS = 15;
const NX_EXIT_METADATA_BYTES = 4;

const require = createRequire(import.meta.url);
export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

const relativeError = (value: number, expected: number) =>
  expected ? Math.abs(value / expected - 1) : value === 0 ? 0 : Infinity;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString = (value: unknown) => typeof value === 'string';

const isCount = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function isArrayOf(value: unknown, validate: (item: unknown) => boolean) {
  return Array.isArray(value) && value.every(validate);
}

function isRecordOf(value: unknown, validate: (item: unknown) => boolean) {
  return isObject(value) && Object.values(value).every(validate);
}

function hasFields(value: unknown, fields: Record<string, (item: unknown) => boolean>) {
  return isObject(value) && Object.entries(fields).every(([key, validate]) => validate(value[key]));
}

function isLayoutEntry(value: unknown) {
  return hasFields(value, {
    id: isCount,
    parent: (parent) => parent === null || isCount(parent),
    depth: isCount,
    type: (type) =>
      type === TarEntryType.File ||
      type === TarEntryType.HardLink ||
      type === TarEntryType.SymbolicLink ||
      type === TarEntryType.Directory ||
      type === TarEntryType.ContiguousFile,
    mode: isString,
    size: isCount,
    extension: isString,
  });
}

function isProfile(value: unknown) {
  return hasFields(value, {
    id: isString,
    compressedBytes: isCount,
    attempts: isCount,
    expandedTarBytes: isCount,
    outputBytes: isCount,
    metadataBytes: isCount,
    fileCount: isCount,
    directoryCount: isCount,
    maxDepth: isCount,
    fileSizeBytes: (sizes) => isArrayOf(sizes, isCount),
    depthCounts: (counts) => isRecordOf(counts, isCount),
    modeCounts: (counts) => isRecordOf(counts, isCount),
    directoryChildCounts: (counts) => isArrayOf(counts, isCount),
    types: (counts) => isRecordOf(counts, isCount),
    extensions: (extensions) =>
      isRecordOf(
        extensions,
        (entry) => isCount(entry) || hasFields(entry, { count: isCount, bytes: isCount }),
      ),
    layout: (layout) => layout === undefined || isArrayOf(layout, isLayoutEntry),
  });
}

function isCorpus(value: unknown): value is RestorationCorpus {
  return hasFields(value, {
    representativeIds: (ids) => isArrayOf(ids, isString),
    profiles: (profiles) => isArrayOf(profiles, isProfile),
  });
}

function parseCorpus(source: string): RestorationCorpus {
  const corpus: unknown = JSON.parse(source);
  if (!isCorpus(corpus)) {
    throw new Error('Invalid restoration corpus');
  }

  return corpus;
}

export async function readCorpus(
  corpusFile: string = 'fixtures/restoration/profile.json',
): Promise<RestorationCorpus> {
  return parseCorpus(await readFile(corpusFile, 'utf8'));
}

function anonymousLayout(profile: FixtureProfile): ArchiveLayoutEntry[] {
  if (profile.layout) {
    return profile.layout;
  }

  // Older surveys retain marginals only. Never claim an exact reconstructed tree.
  const remaining = new Map(
    Object.entries(profile.depthCounts).map(([depth, count]) => [Number(depth), count]),
  );

  const entries: ArchiveLayoutEntry[] = [];
  const parents: Map<number, number> = new Map();
  let directories = profile.directoryCount;
  for (let depth = 1; depth < profile.maxDepth && directories; depth++) {
    const count = remaining.get(depth);
    if (!count) {
      throw new Error('Unrealizable depth histogram');
    }

    const entry: ArchiveLayoutEntry = {
      id: entries.length,
      parent: parents.get(depth - 1) ?? null,
      depth,
      type: TarEntryType.Directory,
      mode: '40755',
      size: 0,
      extension: '(none)',
    };
    entries.push(entry);
    parents.set(depth, entry.id);
    remaining.set(depth, count - 1);
    directories--;
  }

  for (const [depth, count] of remaining) {
    const number = Math.min(count, directories);
    for (let index = 0; index < number; index++) {
      entries.push({
        id: entries.length,
        parent: parents.get(depth - 1) ?? null,
        depth,
        type: TarEntryType.Directory,
        mode: '40755',
        size: 0,
        extension: '(none)',
      });
    }

    remaining.set(depth, count - number);
    directories -= number;
  }

  if (directories) {
    throw new Error('Missing directory depth');
  }

  const extensions = Object.entries(profile.extensions).flatMap(([extension, description]) =>
    Array.from(
      { length: typeof description === 'number' ? description : description.count },
      () => extension,
    ),
  );
  let fileIndex = 0;
  for (const [depth, count] of remaining) {
    for (let index = 0; index < count; index++) {
      const size = profile.fileSizeBytes[fileIndex];
      if (size === undefined) {
        throw new Error('Missing file size');
      }

      entries.push({
        id: entries.length,
        parent: parents.get(depth - 1) ?? null,
        depth,
        type: TarEntryType.File,
        mode: '100644',
        size,
        extension: extensions[fileIndex] ?? 'js',
      });
      fileIndex++;
    }
  }

  if (fileIndex !== profile.fileCount) {
    throw new Error('File histogram mismatch');
  }

  return entries;
}

export function syntheticContent(
  size: number,
  entropyFraction: number,
  seed: string,
  extension: string,
) {
  const repeated = Buffer.from(
    extension.includes('html')
      ? '<div class="fixture">Synthetic benchmark output</div>\n'
      : extension.includes('map')
        ? '{"version":3,"sources":["fixture.ts"],"mappings":"AAAA;AACA"}\n'
        : 'export const fixture = "synthetic benchmark output";\n',
  );
  const bytes = Buffer.alloc(size);
  for (let offset = 0; offset < size; offset += repeated.length) {
    repeated.copy(bytes, offset);
  }

  // Vary unique printable tokens among realistic repeated syntax, deterministically.
  const uniqueBytes = Math.floor(size * entropyFraction);
  let written = 0;
  let counter = 0;
  while (written < uniqueBytes) {
    const hash = createHash('sha256').update(`${seed}:${counter++}`);
    const token = extension === 'png' ? hash.digest() : Buffer.from(hash.digest('base64'));
    const offset = Math.floor((written * size) / Math.max(1, uniqueBytes));
    written += token.copy(bytes, offset, 0, Math.min(token.length, uniqueBytes - written));
  }

  return bytes;
}

export function assertCalibration(
  expected: FixtureProfile,
  actual: RestorationProfile,
  { exactLayout = false }: { exactLayout?: boolean } = {},
) {
  const scalarKeys: (
    | 'fileCount'
    | 'directoryCount'
    | 'maxDepth'
    | 'outputBytes'
    | 'metadataBytes'
  )[] = ['fileCount', 'directoryCount', 'maxDepth', 'outputBytes', 'metadataBytes'];

  const summaryKeys: ('modeCounts' | 'extensions' | 'types')[] = [
    'modeCounts',
    'extensions',
    'types',
  ];
  for (const key of scalarKeys) {
    if (actual[key] !== expected[key]) {
      throw new Error(`Calibration ${expected.id}: ${key}`);
    }
  }

  for (const key of summaryKeys) {
    if (!isDeepStrictEqual(actual[key], expected[key])) {
      throw new Error(`Calibration ${expected.id}: ${key}`);
    }
  }

  if (JSON.stringify(actual.depthCounts) !== JSON.stringify(expected.depthCounts)) {
    throw new Error(`Calibration ${expected.id}: depth histogram`);
  }
  if (JSON.stringify(actual.fileSizeBytes) !== JSON.stringify(expected.fileSizeBytes)) {
    throw new Error(`Calibration ${expected.id}: file sizes`);
  }
  if (
    exactLayout &&
    JSON.stringify(actual.directoryChildCounts) !== JSON.stringify(expected.directoryChildCounts)
  ) {
    throw new Error(`Calibration ${expected.id}: directory density`);
  }
  if (relativeError(actual.compressedBytes, expected.compressedBytes) > 0.1) {
    throw new Error(
      `Calibration ${expected.id}: compressed bytes (${actual.compressedBytes}/${expected.compressedBytes})`,
    );
  }
  if (relativeError(actual.expandedTarBytes, expected.expandedTarBytes) > 0.05) {
    throw new Error(`Calibration ${expected.id}: expanded archive`);
  }
}

export async function generateCorpus({
  directory,
  all = false,
  corpusFile = 'fixtures/restoration/profile.json',
  signal,
}: {
  directory: string;
  all?: boolean;
  corpusFile?: string;
  signal?: AbortSignal;
}): Promise<GeneratedCorpus> {
  signal?.throwIfAborted();
  const corpusBytes = await readFile(corpusFile);
  const corpus = parseCorpus(corpusBytes.toString('utf8'));
  const profiles = all
    ? corpus.profiles
    : corpus.profiles.filter((profile) => corpus.representativeIds.includes(profile.id));

  await mkdir(directory, { recursive: true });
  const scratch = join(directory, 'serializer');

  try {
    return await withArchiveSerializer(async (store) => {
      const fixtures: GeneratedFixture[] = [];
      for (const profile of profiles) {
        signal?.throwIfAborted();
        const layout = anonymousLayout(profile);
        const paths: Map<number, string> = new Map();

        const entryPath = (id: number) => {
          const name = paths.get(id);
          if (name === undefined) {
            throw new Error('Layout path missing');
          }

          return name;
        };
        const hash = sha256(Buffer.from(`restoration-v1:${sha256(corpusBytes)}:${profile.id}`));
        const root = join(scratch, hash);
        await mkdir(root, { recursive: true });
        for (const entry of layout) {
          const parent = entry.parent === null ? '' : paths.get(entry.parent);
          if (parent === undefined) {
            throw new Error('Layout parent missing');
          }

          const extension =
            entry.extension === '(none)' ? '' : `.${entry.extension.replace(/^\./, '')}`;
          const name = join(
            parent,
            `entry-${String(entry.id).padStart(3, '0')}${entry.type === TarEntryType.Directory ? '' : extension}`,
          );
          paths.set(entry.id, name);
          if (entry.type === TarEntryType.Directory) {
            await mkdir(join(root, name), { recursive: true });
          } else if (
            entry.type !== TarEntryType.File &&
            entry.type !== TarEntryType.ContiguousFile
          ) {
            throw new Error('Link fixture requires explicit target metadata');
          }
        }

        let low = 0;
        let high = 1;
        let bestError = Infinity;
        let best: { bytes: Buffer; fraction: number } | undefined;
        for (let trial = 0; trial < CALIBRATION_SEARCH_TRIALS; trial++) {
          signal?.throwIfAborted();
          const fraction = trial === 0 ? 0 : trial === 1 ? 1 : (low + high) / 2;
          for (const entry of layout.filter((entry) => entry.type !== TarEntryType.Directory)) {
            const file = join(root, entryPath(entry.id));
            await mkdir(dirname(file), { recursive: true });
            await writeFile(
              file,
              syntheticContent(entry.size, fraction, `${profile.id}:${entry.id}`, entry.extension),
              { mode: Number.parseInt(entry.mode, OCTAL_RADIX) & FilePermissions.Mask },
            );
            await utimes(file, 0, 0);
          }

          for (const entry of layout.filter((entry) => entry.type === TarEntryType.Directory)) {
            await utimes(join(root, entryPath(entry.id)), 0, 0);
          }

          const terminal = syntheticContent(
            Math.max(0, profile.metadataBytes - NX_EXIT_METADATA_BYTES),
            fraction,
            `${profile.id}:terminal`,
            'log',
          ).toString('utf8');
          const bytes = await store(hash, scratch, terminal);

          const error = relativeError(bytes.length, profile.compressedBytes);
          if (error < bestError) {
            bestError = error;
            best = { bytes, fraction };
          }
          if (error <= 0.01) {
            break;
          }
          if (bytes.length < profile.compressedBytes) {
            low = fraction;
          } else {
            high = fraction;
          }
        }

        if (!best) {
          throw new Error('No calibrated archive');
        }

        const actual = profileArchive(best.bytes, { id: profile.id, includeLayout: true });
        assertCalibration(profile, actual, { exactLayout: Boolean(profile.layout) });

        const file = join(directory, `${hash}.tgz`);
        await writeFile(file, best.bytes);

        const manifest = [];
        // Regenerate the selected payload; the final search trial may differ from best.
        for (const entry of layout.filter((entry) => entry.type !== TarEntryType.Directory)) {
          manifest.push({
            path: entryPath(entry.id),
            size: entry.size,
            mode: Number.parseInt(entry.mode, OCTAL_RADIX) & FilePermissions.Mask,
            digest: sha256(
              syntheticContent(
                entry.size,
                best.fraction,
                `${profile.id}:${entry.id}`,
                entry.extension,
              ),
            ),
          });
        }

        fixtures.push({
          profileId: profile.id,
          hash,
          digest: sha256(best.bytes),
          file: resolve(file),
          bytes: best.bytes.length,
          attempts: profile.attempts,
          calibration: actual,
          exactLayout: Boolean(profile.layout),
          manifest,
          directories: layout
            .filter((entry) => entry.type === TarEntryType.Directory)
            .map((entry) => ({
              path: entryPath(entry.id),
              mode: Number.parseInt(entry.mode, OCTAL_RADIX) & FilePermissions.Mask,
            })),
          terminalDigest: sha256(
            syntheticContent(
              Math.max(0, profile.metadataBytes - NX_EXIT_METADATA_BYTES),
              best.fraction,
              `${profile.id}:terminal`,
              'log',
            ),
          ),
          code: 0,
        });
      }

      const nxPackage: { version: string } = require('nx/package.json');
      const result: GeneratedCorpus = {
        schemaVersion: 1,
        corpusDigest: sha256(corpusBytes),
        nx: nxPackage.version,
        synthetic: true,
        fixtures,
      };
      await writeFile(join(directory, 'manifest.json'), JSON.stringify(result, null, 2));

      return result;
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(
    process.argv.slice(NODE_USER_ARGUMENT_OFFSET).find((argument) => !argument.startsWith('--')) ??
      '.output/restoration-corpus',
  );
  const result = await generateCorpus({ directory, all: process.argv.includes('--all') });
  console.log(
    JSON.stringify({
      corpusDigest: result.corpusDigest,
      fixtures: result.fixtures.length,
      bytes: result.fixtures.reduce((sum, fixture) => sum + fixture.bytes, 0),
    }),
  );
}
