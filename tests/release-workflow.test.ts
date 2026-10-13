import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { FilePermissions } from '../src/filesystem.js';
import { withTemporaryDirectory } from './helpers.js';

const exec = promisify(execFile);
const assets = ['LICENSE', 'nscloud-nx-cache-action.mjs'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function publicationScript(): Promise<string> {
  const workflow: unknown = parse(await readFile('.github/workflows/release.yml', 'utf8'));
  assert(isRecord(workflow) && isRecord(workflow.jobs));
  assert(isRecord(workflow.jobs.release) && Array.isArray(workflow.jobs.release.steps));

  const step: unknown = workflow.jobs.release.steps.find(
    (entry: unknown) =>
      isRecord(entry) && entry.name === 'Attach verified assets to published release',
  );
  assert(isRecord(step) && typeof step.run === 'string');
  return step.run;
}

const ghDouble = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const remote = process.env.TEST_REMOTE;
const uploads = process.env.TEST_UPLOADS;
const option = name => args[args.indexOf(name) + 1];
if (args[0] !== 'release' || args[2] !== 'v0.1.1') process.exit(2);
switch (args[1]) {
  case 'view':
    if (process.env.TEST_FAILURE === 'view') process.exit(1);
    console.log(JSON.stringify(process.env.TEST_FAILURE === 'metadata' ? {} : { assets: fs.readdirSync(remote).map(name => ({ name })) }));
    break;
  case 'upload': {
    const files = args.slice(3, args.indexOf('--repo'));
    const names = files.map(file => path.basename(file));
    for (const file of files) {
      fs.copyFileSync(file, path.join(remote, path.basename(file)), fs.constants.COPYFILE_EXCL);
    }
    fs.writeFileSync(uploads, JSON.stringify(names));
    break;
  }
  case 'download': {
    const names = args.includes('--pattern') ? [option('--pattern')] : fs.readdirSync(remote);
    for (const name of names) fs.copyFileSync(path.join(remote, name), path.join(option('--dir'), name));
    if (process.env.TEST_FAILURE === 'download') {
      fs.writeFileSync(path.join(option('--dir'), names[0]), 'changed after upload');
    }
    break;
  }
  default:
    process.exit(2);
}
`;

interface PublicationCase {
  name: string;
  existing: string[];
  mismatch?: boolean;
  failure?: 'view' | 'metadata' | 'download';
  succeeds: boolean;
  uploaded: string[];
}

const cases: PublicationCase[] = [
  { name: 'uploads missing assets', existing: [], succeeds: true, uploaded: assets },
  { name: 'preserves matching assets on retry', existing: assets, succeeds: true, uploaded: [] },
  {
    name: 'rejects existing mismatches before uploading anything',
    existing: ['nscloud-nx-cache-action.mjs'],
    mismatch: true,
    succeeds: false,
    uploaded: [],
  },
  {
    name: 'fails when release metadata is unavailable',
    existing: [],
    failure: 'view',
    succeeds: false,
    uploaded: [],
  },
  {
    name: 'rejects changed download bytes after upload',
    existing: [],
    failure: 'download',
    succeeds: false,
    uploaded: assets,
  },
  {
    name: 'rejects malformed metadata before uploading anything',
    existing: [],
    failure: 'metadata',
    succeeds: false,
    uploaded: [],
  },
];

for (const scenario of cases) {
  test(`release publication ${scenario.name}`, async () => {
    await withTemporaryDirectory(async (directory) => {
      const built = join(directory, 'built');
      const remote = join(directory, 'remote');
      const bin = join(directory, 'bin');
      const uploads = join(directory, 'uploads.json');
      await Promise.all([built, remote, bin].map((entry) => mkdir(entry)));
      await writeFile(uploads, '[]');

      for (const name of assets) {
        await writeFile(join(built, name), `reviewed ${name}`);
      }
      for (const name of scenario.existing) {
        await writeFile(
          join(remote, name),
          scenario.mismatch ? 'different release bytes' : `reviewed ${name}`,
        );
      }
      await writeFile(join(bin, 'gh'), ghDouble, { mode: FilePermissions.Executable });

      const run = exec(
        'bash',
        ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', await publicationScript()],
        {
          cwd: directory,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ''}`,
            TMPDIR: directory,
            RELEASE_TAG: 'v0.1.1',
            RELEASE_ASSET_DIRECTORY: built,
            GITHUB_REPOSITORY: 'example/cache-action',
            TEST_REMOTE: remote,
            TEST_UPLOADS: uploads,
            TEST_FAILURE: scenario.failure ?? '',
          },
        },
      );
      if (scenario.succeeds) {
        await run;
        for (const name of assets) {
          assert.equal(await readFile(join(remote, name), 'utf8'), `reviewed ${name}`);
        }
      } else {
        await assert.rejects(run);
      }

      assert.deepEqual(JSON.parse(await readFile(uploads, 'utf8')), scenario.uploaded);
    });
  });
}
