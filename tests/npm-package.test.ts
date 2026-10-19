import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import projectPackage from '../package.json' with { type: 'json' };
import { buildDistributions, withTemporaryDirectory } from './helpers.js';
import { matchesPublishedVersion, waitForPublishedVersion } from '../scripts/publish-npm.js';

const exec = promisify(execFile);

test('packed npm package installs both CLIs without source or runtime dependencies', async () => {
  await withTemporaryDirectory(async (directory) => {
    await buildDistributions(directory);
    for (const name of [...projectPackage.files, 'README.md', 'package.json']) {
      if (name.startsWith('dist/')) {
        continue;
      }
      const destination = join(directory, name);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(name, destination);
    }

    const packed = join(directory, '.output/npm');
    await exec('npm', ['pack', '--pack-destination', packed], { cwd: directory });
    const archives = (await readdir(packed)).filter((name) => name.endsWith('.tgz'));
    assert.equal(archives.length, 1);
    const archive = archives[0];
    assert(archive);
    const tarball = join(packed, archive);
    const listing = await exec('tar', ['-tzf', tarball]);
    assert.deepEqual(
      listing.stdout.trim().split('\n').sort(),
      [
        'package/LICENSE',
        'package/NOTICE',
        'package/README.md',
        'package/THIRD_PARTY_LICENSES.txt',
        'package/dist/nscloud-nx-cache-action.mjs',
        'package/dist/token.mjs',
        'package/docs/benchmarking.md',
        'package/docs/configuration.md',
        'package/docs/operations.md',
        'package/docs/vercel.md',
        'package/package.json',
      ].sort(),
    );

    const consumer = join(directory, 'consumer');
    await mkdir(consumer);
    await writeFile(
      join(consumer, 'package.json'),
      JSON.stringify({ private: true, packageManager: projectPackage.packageManager }),
    );
    await exec('corepack', ['pnpm', 'add', '--save-dev', tarball], { cwd: consumer });
    const installed: unknown = JSON.parse(
      await readFile(join(consumer, 'node_modules', projectPackage.name, 'package.json'), 'utf8'),
    );
    assert(typeof installed === 'object' && installed !== null);
    assert(!('dependencies' in installed));

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NX_ARCHIVE_DIRECTORY: join(directory, 'archives'),
    };
    delete env.NX_ARTIFACT_PREFIX;
    const result = await exec(
      'corepack',
      [
        'pnpm',
        'exec',
        'nscloud-nx-cache-action',
        process.execPath,
        '-e',
        'console.log(process.argv[1])',
        'literal $HOME',
      ],
      { cwd: consumer, env },
    );
    assert.equal(result.stdout.trim(), 'literal $HOME');
    await assert.rejects(
      exec('corepack', ['pnpm', 'exec', 'nx-namespace-token'], { cwd: consumer, env }),
      (error) =>
        error instanceof Error &&
        'stderr' in error &&
        typeof error.stderr === 'string' &&
        error.stderr.includes('Expected access mode followed by command'),
    );
  });
});

test('npm retries require matching integrity; outages and malformed metadata fail', async () => {
  const integrity = 'sha512-reviewed-package';
  assert.equal(
    await matchesPublishedVersion(new Response(null, { status: 404 }), integrity),
    false,
  );
  assert.equal(
    await matchesPublishedVersion(Response.json({ dist: { integrity } }), integrity),
    true,
  );
  await assert.rejects(
    matchesPublishedVersion(Response.json({ dist: { integrity: 'sha512-different' } }), integrity),
    /differs/,
  );
  await assert.rejects(
    matchesPublishedVersion(new Response(null, { status: 503 }), integrity),
    /HTTP 503/,
  );
  await assert.rejects(
    matchesPublishedVersion(Response.json({}), integrity),
    /Missing npm package integrity/,
  );
  await assert.rejects(
    matchesPublishedVersion(new Response('not JSON'), integrity),
    /Invalid npm registry metadata/,
  );
});

test('post-publish verification retries 404s until the version is readable or time runs out', async () => {
  const integrity = 'sha512-reviewed-package';
  const timeoutMs = 50;
  const intervalMs = 1;
  const sequence = (responses: (() => Response)[]) => {
    let calls = 0;
    const lookup = async () => {
      const next = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      assert(next);
      return next();
    };
    return { lookup, calls: () => calls };
  };
  const missing = () => new Response(null, { status: 404 });

  const visibleLater = sequence([missing, missing, () => Response.json({ dist: { integrity } })]);
  await waitForPublishedVersion(visibleLater.lookup, integrity, timeoutMs, intervalMs);
  assert.equal(visibleLater.calls(), 3);

  const neverVisible = sequence([missing]);
  await assert.rejects(
    waitForPublishedVersion(neverVisible.lookup, integrity, timeoutMs, intervalMs),
    /not available for verification/,
  );
  assert(neverVisible.calls() > 1);

  const outage = sequence([missing, () => new Response(null, { status: 503 })]);
  await assert.rejects(
    waitForPublishedVersion(outage.lookup, integrity, timeoutMs, intervalMs),
    /HTTP 503/,
  );
  assert.equal(outage.calls(), 2);

  const conflict = sequence([
    missing,
    () => Response.json({ dist: { integrity: 'sha512-other' } }),
  ]);
  await assert.rejects(
    waitForPublishedVersion(conflict.lookup, integrity, timeoutMs, intervalMs),
    /differs/,
  );
  assert.equal(conflict.calls(), 2);
});
