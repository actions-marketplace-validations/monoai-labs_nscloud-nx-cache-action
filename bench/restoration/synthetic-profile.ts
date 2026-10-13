/**
 * Build the public corpus from explicit synthetic workload and stress recipes.
 * Files, layouts, payloads and weights are generated here, without input archives,
 * logs or repository history. Nx serialization supplies the calibration targets.
 *
 * Run: pnpm exec tsx bench/restoration/synthetic-profile.ts.
 * Writes: fixtures/restoration/profile.json; removes its owned temporary directory.
 */

import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { withArchiveSerializer } from './archive-serializer.js';
import { sha256, syntheticContent } from './fixture.js';
import { profileArchive } from './profile.js';
import { FilePermissions } from '../../src/filesystem.js';
import { KIBIBYTE, MEBIBYTE } from '../../src/units.js';
import projectPackage from '../../package.json' with { type: 'json' };

interface SyntheticRecipe {
  id: string;
  weight: number;
  directories: number;
  depth: number;
  sizes: number[];
  extensions: string[];
  metadataBytes: number;
  entropy: number;
  executable?: boolean;
}

const LIBRARY_EXTENSIONS = ['js', 'js.map', 'd.ts', 'd.ts.map'];
const SITE_EXTENSIONS = ['html', 'html', 'html', 'html', 'json', 'css'];
const NX_EXIT_METADATA_BYTES = 4;
const sizes = (count: number, bytes: number) => Array.from({ length: count }, () => bytes);
const librarySizes = (modules: number) =>
  Array.from({ length: modules }, () => [8, 8, 4, 2].map((size) => size * KIBIBYTE)).flat();
const siteSizes = (totalBytes: number) => [
  totalBytes / 4,
  totalBytes / 4,
  totalBytes / 4,
  totalBytes / 4 - 5 * KIBIBYTE,
  4 * KIBIBYTE,
  KIBIBYTE,
];

export const SYNTHETIC_RECIPES: readonly SyntheticRecipe[] = [
  {
    id: 'empty',
    weight: 5,
    directories: 0,
    depth: 0,
    sizes: [],
    extensions: [],
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'metadata',
    weight: 10,
    directories: 0,
    depth: 0,
    sizes: [],
    extensions: [],
    metadataBytes: KIBIBYTE,
    entropy: 0.6,
  },
  {
    id: 'terminal',
    weight: 5,
    directories: 0,
    depth: 0,
    sizes: [],
    extensions: [],
    metadataBytes: 2 * KIBIBYTE,
    entropy: 0.4,
  },
  {
    id: 'tiny-library',
    weight: 5,
    directories: 4,
    depth: 5,
    sizes: [2 * KIBIBYTE, 2 * KIBIBYTE, KIBIBYTE, 512],
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'small-library',
    weight: 20,
    directories: 5,
    depth: 6,
    sizes: librarySizes(2),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'medium-library',
    weight: 20,
    directories: 5,
    depth: 6,
    sizes: librarySizes(4),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'large-library',
    weight: 15,
    directories: 7,
    depth: 8,
    sizes: librarySizes(16),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 2 * KIBIBYTE,
    entropy: 0.2,
  },
  {
    id: 'site',
    weight: 10,
    directories: 6,
    depth: 7,
    sizes: siteSizes(MEBIBYTE),
    extensions: SITE_EXTENSIONS,
    metadataBytes: 2 * KIBIBYTE,
    entropy: 0.4,
  },
  {
    id: 'large-site',
    weight: 10,
    directories: 6,
    depth: 7,
    sizes: siteSizes(2 * MEBIBYTE),
    extensions: SITE_EXTENSIONS,
    metadataBytes: 2 * KIBIBYTE,
    entropy: 0.3,
  },
  {
    id: 'stress-large-file',
    weight: 0,
    directories: 1,
    depth: 2,
    sizes: sizes(1, 8 * MEBIBYTE),
    extensions: ['js'],
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'stress-high-entropy',
    weight: 0,
    directories: 1,
    depth: 2,
    sizes: sizes(1, 2 * MEBIBYTE),
    extensions: ['png'],
    metadataBytes: 64,
    entropy: 1,
  },
  {
    id: 'stress-many-files',
    weight: 0,
    directories: 16,
    depth: 3,
    sizes: sizes(512, 64),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'stress-deep-tree',
    weight: 0,
    directories: 15,
    depth: 16,
    sizes: sizes(16, 512),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
  {
    id: 'stress-executable',
    weight: 0,
    directories: 1,
    depth: 2,
    sizes: sizes(8, KIBIBYTE),
    extensions: ['js'],
    metadataBytes: 64,
    entropy: 0.2,
    executable: true,
  },
  {
    id: 'stress-terminal',
    weight: 0,
    directories: 0,
    depth: 0,
    sizes: [],
    extensions: [],
    metadataBytes: 256 * KIBIBYTE,
    entropy: 0.65,
  },
  {
    id: 'stress-empty-files',
    weight: 0,
    directories: 8,
    depth: 3,
    sizes: sizes(4, 0),
    extensions: LIBRARY_EXTENSIONS,
    metadataBytes: 64,
    entropy: 0.2,
  },
];

export async function syntheticCorpus() {
  const scratch = await mkdtemp(join(tmpdir(), 'synthetic-profile-'));
  try {
    return await withArchiveSerializer(async (store) => {
      const profiles = [];
      for (const recipe of SYNTHETIC_RECIPES) {
        const id = `synthetic-${recipe.id}`;
        const hash = sha256(id);
        const root = join(scratch, hash);
        await mkdir(root);

        const directories: string[] = [];
        for (let index = 0; index < recipe.directories; index++) {
          const parent = index < recipe.depth - 1 ? (directories.at(-1) ?? '') : '';
          const directory = join(parent, `entry-${String(index).padStart(3, '0')}`);
          directories.push(directory);
          await mkdir(join(root, directory), { recursive: true });
        }

        for (const [index, size] of recipe.sizes.entries()) {
          const entryId = recipe.directories + index;
          const extension = recipe.extensions[index % recipe.extensions.length];
          if (!extension) {
            throw new Error('Synthetic file requires an extension');
          }

          const parent = directories[index % directories.length] ?? '';
          const file = join(root, parent, `entry-${String(entryId).padStart(3, '0')}.${extension}`);
          const mode =
            recipe.executable && index % 2 === 0
              ? FilePermissions.Executable
              : FilePermissions.ReadableFile;
          await writeFile(
            file,
            syntheticContent(size, recipe.entropy, `${id}:${entryId}`, extension),
            { mode },
          );
          await utimes(file, 0, 0);
        }

        for (const directory of directories) {
          await utimes(join(root, directory), 0, 0);
        }

        const terminal = syntheticContent(
          recipe.metadataBytes - NX_EXIT_METADATA_BYTES,
          recipe.entropy,
          `${id}:terminal`,
          'log',
        ).toString('utf8');
        const archive = await store(hash, scratch, terminal);
        profiles.push(
          profileArchive(archive, { id, attempts: recipe.weight, includeLayout: true }),
        );
      }

      const require = createRequire(import.meta.url);
      const nx: { version: string } = require('nx/package.json');
      return {
        schemaVersion: 1,
        provenance: {
          kind: 'synthetic',
          generator: 'bench/restoration/synthetic-profile.ts',
          productionRepresentative: false,
          weightBasis: 'Designed workload mix totaling 100; stress profiles have zero weight.',
          limitations: [
            'No production arrival sequence',
            'No claim of complete production coverage',
            'Stress cases are separate from ordinary workload weights',
          ],
        },
        runtime: {
          node: process.versions.node,
          pnpm: projectPackage.packageManager.replace(/^pnpm@/, ''),
          nx: nx.version,
        },
        margins: {
          median: { relative: 0.1, absoluteMs: 10 },
          p95: { relative: 0.15, absoluteMs: 25 },
        },
        tolerances: { structure: 0, expandedBytes: 0.05, compressedBytes: 0.1 },
        representativeIds: profiles
          .filter((profile) => profile.attempts > 0)
          .map((profile) => profile.id),
        seeds: [101, 202, 303],
        profiles,
      };
    });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const corpus = await syntheticCorpus();
  await writeFile('fixtures/restoration/profile.json', `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(
    JSON.stringify({
      profiles: corpus.profiles.length,
      workloadProfiles: corpus.representativeIds.length,
    }),
  );
}
