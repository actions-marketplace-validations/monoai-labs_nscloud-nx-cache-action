import type { CacheEvent, SampleInput } from '../bench/restoration/controller-types.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertSampleProof,
  buildOrder,
  captureFailureSample,
  INVENTORY_QUANTILES,
  populateInventory,
  startBundleWorker,
  verifyMountEvidence,
} from '../bench/restoration/run.js';
import { LocalStore } from '../src/local-store.js';
import { HttpStatus } from '../src/http.js';
import { CacheOperation, CacheTier } from '../src/metrics.js';
import { KIBIBYTE, SECOND_MS } from '../src/units.js';
import {
  PROCESS_EXISTENCE_PROBE,
  ProcessSignal,
  ExitCode,
  NODE_USER_ARGUMENT_OFFSET,
} from '../src/process-constants.js';

const MOCK_AUTH_TOKEN_CHARACTERS = 64;

const WORKER_TEST_TIMEOUT_MS = 20 * SECOND_MS;
const WORKER_EVENT_POLL_INTERVAL_MS = 5;

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('paired arm order is frozen, reproducible, complete and includes excluded first/warm access', () => {
  const profiles = [{ profileId: 'profile-a' }, { profileId: 'profile-b' }];
  const order = buildOrder(profiles, { pairs: 20, seed: 'known-job' });
  assert.deepEqual(order, buildOrder(profiles, { pairs: 20, seed: 'known-job' }));
  assert.notDeepEqual(order, buildOrder(profiles, { pairs: 20, seed: 'another-job' }));
  assert.equal(order.length, 2 * 2 * 22 * 2);

  for (const profile of profiles) {
    for (const concurrency of [1, 3]) {
      for (const lane of ['adapter-remote', 'adapter-local']) {
        const group = order.filter(
          (entry) =>
            entry.profileId === profile.profileId &&
            entry.concurrency === concurrency &&
            entry.lane === lane,
        );
        assert.equal(group.filter((entry) => !entry.excluded).length, 20);
        assert.equal(group.filter((entry) => entry.excluded === 'first-access').length, 1);
        assert.equal(group.filter((entry) => entry.excluded === 'warmup').length, 1);

        for (const entry of group) {
          assert.deepEqual([...entry.arms].sort(), ['baseline', 'candidate']);
        }
      }
    }
  }

  assert(
    buildOrder(profiles, { pairs: 1, offline: true }).every(
      (entry) => entry.lane === 'adapter-local',
    ),
  );
});

test('complete-body/tier gate rejects corruption, missing/duplicate GETs and publications', () => {
  const bytes = Buffer.from('synthetic compressed bytes');
  const fixtures = [{ hash: 'one', bytes: bytes.length, digest: sha(bytes) }];
  const responses = [{ hash: 'one', status: HttpStatus.Ok, bytes }];

  const events: CacheEvent[] = [
    {
      hash: 'one',
      operation: CacheOperation.Get,
      tier: CacheTier.Artifact,
      durationMs: 1,
      bytes: bytes.length,
    },
  ];
  const valid: SampleInput = { responses, fixtures, events, tier: CacheTier.Artifact };
  const [response] = responses;
  const [event] = events;

  assert(response);
  assert(event);

  const proof = assertSampleProof(valid);
  assert.equal(proof.proof.digest, sha(bytes));
  assert.equal(proof.bytes, bytes.length);

  assert.throws(
    () => assertSampleProof({ ...valid, responses: [{ ...response, bytes: bytes.subarray(1) }] }),
    /body-mismatch/,
  );

  assert.throws(
    () => assertSampleProof({ ...valid, events: [{ ...event, tier: CacheTier.Local }] }),
    /tier-mismatch/,
  );
  assert.throws(() => assertSampleProof({ ...valid, events: [] }), /tier-mismatch/);
  assert.throws(
    () => assertSampleProof({ ...valid, events: [...events, ...events] }),
    /tier-mismatch/,
  );

  assert.throws(
    () =>
      assertSampleProof({
        ...valid,
        events: [
          ...events,
          { operation: CacheOperation.Publish, tier: CacheTier.Artifact, durationMs: 0 },
        ],
      }),
    /publication/,
  );

  assert.throws(
    () =>
      assertSampleProof({ ...valid, responses: [{ ...response, status: HttpStatus.NotFound }] }),
    /http-status/,
  );
});

test('failed batch evidence retains server/client disagreement without payloads or secrets', () => {
  const bytes = Buffer.from('synthetic full body');
  const fixtures = [
    { hash: 'one', bytes: bytes.length, digest: sha(bytes), signedUrl: 'private-url' },
  ];
  const responses = [
    { hash: 'one', status: HttpStatus.Ok, bytes, url: 'private-url', token: 'private-token' },
  ];

  const events: (CacheEvent & { token: string; signedUrl: string })[] = [
    {
      hash: 'one',
      operation: CacheOperation.Get,
      tier: CacheTier.Error,
      durationMs: 1,
      token: 'private-token',
      signedUrl: 'private-url',
      errorCode: 'private-error',
    },
  ];
  const failed = captureFailureSample({ responses, fixtures, events, tier: CacheTier.Local });
  assert.deepEqual(failed.responses, [
    { hash: 'one', status: 200, bytes: bytes.length, digest: sha(bytes) },
  ]);

  const [failedEvent] = failed.events;
  assert(failedEvent);
  assert.equal(failedEvent.tier, 'error');

  const text = JSON.stringify(failed);
  assert(!text.includes('synthetic full body'));
  assert(!text.includes('private-'));
  assert.throws(
    () => assertSampleProof({ responses, fixtures, events, tier: CacheTier.Local }),
    /unexpected-cache-event/,
  );
});

test(
  'bundle worker uses executable production CLI, sanitizes events and reaps owned wrapper/worker',
  { timeout: WORKER_TEST_TIMEOUT_MS },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nx-restoration-controller-'));
    const bundle = join(directory, 'test-bundle.mjs');

    // This double exercises the controller process boundary, not Artifact behavior.
    await writeFile(
      bundle,
      `import {spawn} from 'node:child_process'; import {createServer} from 'node:http';
    const server=createServer((request,response)=>{const hash=request.url.split('/').pop();response.writeHead(${HttpStatus.Ok}).end('archive');console.error(JSON.stringify({cache:{operation:'get',tier:'local',hash,bytes:7,durationMs:1,credential:'private-value'}}));});
    server.listen(0,'127.0.0.1',()=>{const child=spawn(process.argv[${NODE_USER_ARGUMENT_OFFSET}],process.argv.slice(${NODE_USER_ARGUMENT_OFFSET + 1}),{env:{...process.env,NX_SELF_HOSTED_REMOTE_CACHE_SERVER:'http://127.0.0.1:'+server.address().port,NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN:'a'.repeat(${MOCK_AUTH_TOKEN_CHARACTERS})},stdio:'ignore'});child.on('exit',code=>{server.close(()=>process.exitCode=code);});});
    console.error('private noise must never become evidence');`,
    );

    let worker;
    try {
      worker = await startBundleWorker({
        bundle,
        directory: join(directory, 'worker'),
        archive: join(directory, 'archive'),
      });

      const response = await fetch(`${worker.url}/v1/cache/test`, {
        headers: { authorization: `Bearer ${worker.token}` },
      });
      assert.equal(await response.text(), 'archive');

      for (let iteration = 0; iteration < 100 && !worker.events.length; iteration++) {
        await new Promise((resolve) => setTimeout(resolve, WORKER_EVENT_POLL_INTERVAL_MS));
      }

      assert.deepEqual(worker.events, [
        { operation: 'get', tier: 'local', durationMs: 1, bytes: 7, hash: 'test' },
      ]);

      await worker.close();
      await worker.close();

      await assert.rejects(fetch(`${worker.url}/v1/cache/test`));

      const names = await readdir(join(directory, 'worker'));
      assert.deepEqual(names.sort(), ['ready.json', 'stop']);
      assert(!JSON.stringify(worker.events).includes('private-value'));
    } finally {
      if (worker) {
        await worker.close();
      }

      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('unrelated inventory matches synthetic size quantiles with valid independent metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-restoration-inventory-'));

  try {
    const inventory = await populateInventory(directory, 101);
    assert.equal(inventory.entries, 101);
    assert(inventory.totalArchiveBytes < 15 * KIBIBYTE * KIBIBYTE);

    const local = new LocalStore(directory);
    for (const [quantile, size] of INVENTORY_QUANTILES) {
      const file = await local.get(`inventory-${Math.round(quantile * 100)}`);
      assert(file);
      assert.equal((await readFile(file)).length, size);
    }

    assert.equal((await readdir(local.directory)).length, 101);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  'failed stopfile write still terminates and reaps owned wrapper/worker',
  { timeout: WORKER_TEST_TIMEOUT_MS },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nx-restoration-stop-failure-'));
    const bundle = join(directory, 'test-bundle.mjs');
    await writeFile(
      bundle,
      `import {spawn} from 'node:child_process'; import {createServer} from 'node:http';
    let child; process.on(${JSON.stringify(ProcessSignal.Terminate)},()=>child?.kill(${JSON.stringify(ProcessSignal.Terminate)}));
    const server=createServer((_request,response)=>response.writeHead(${HttpStatus.NotFound}).end());
    server.listen(0,'127.0.0.1',()=>{child=spawn(process.argv[${NODE_USER_ARGUMENT_OFFSET}],process.argv.slice(${NODE_USER_ARGUMENT_OFFSET + 1}),{env:{...process.env,NX_SELF_HOSTED_REMOTE_CACHE_SERVER:'http://127.0.0.1:'+server.address().port,NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN:'b'.repeat(${MOCK_AUTH_TOKEN_CHARACTERS})},stdio:'ignore'});child.on('exit',(code,signal)=>server.close(()=>process.exitCode=code??${ExitCode.Terminated}));});`,
    );

    let worker;
    try {
      worker = await startBundleWorker({
        bundle,
        directory: join(directory, 'worker'),
        archive: join(directory, 'archive'),
      });

      const ready: unknown = JSON.parse(
        await readFile(join(directory, 'worker', 'ready.json'), 'utf8'),
      );
      assert(ready && typeof ready === 'object' && 'pid' in ready && typeof ready.pid === 'number');

      const pid = ready.pid;

      await rm(join(directory, 'worker'), { recursive: true });

      await assert.rejects(worker.close(), /stop-file-failure/);
      assert.throws(() => process.kill(pid, PROCESS_EXISTENCE_PROBE));
      await assert.rejects(fetch(`${worker.url}/v1/cache/test`));
    } finally {
      if (worker) {
        await worker.close();
      }

      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('mount evidence binds to configured cache root and does not claim physical NVMe identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-restoration-mount-'));

  try {
    const mount = {
      filesystems: [
        {
          source: '/dev/test-device',
          target: directory,
          fstype: 'ext4',
          options: 'private-discarded',
        },
      ],
    };
    const deviceOptions = {
      deviceFor: async (file: string) => (file === '/' ? 1n : 2n),
    };
    const proof = await verifyMountEvidence(mount, directory, deviceOptions);
    assert.match(proof.scope, /NVMe identity is unverified/);
    assert(!JSON.stringify(proof).includes('private-discarded'));

    const bind = await verifyMountEvidence(
      {
        filesystems: [
          { ...mount.filesystems[0], source: '/dev/vdi[/home/runner/.cache/nx-restoration]' },
        ],
      },
      directory,
      deviceOptions,
    );
    assert.equal(bind.device, '/dev/vdi');
    assert.equal(bind.filesystemRoot, '/home/runner/.cache/nx-restoration');

    await assert.rejects(
      verifyMountEvidence(
        { filesystems: [{ ...mount.filesystems[0], target: tmpdir() }] },
        directory,
        deviceOptions,
      ),
      /target-mismatch/,
    );

    await assert.rejects(
      verifyMountEvidence(
        { filesystems: [{ ...mount.filesystems[0], source: 'token@provider' }] },
        directory,
        deviceOptions,
      ),
      /invalid-mount-evidence/,
    );

    await assert.rejects(
      verifyMountEvidence(mount, directory, { deviceFor: async () => 1n }),
      /root-filesystem/,
    );

    await assert.rejects(
      verifyMountEvidence(
        { filesystems: [{ ...mount.filesystems[0], fstype: 'tmpfs' }] },
        directory,
        deviceOptions,
      ),
      /unsupported-cache-filesystem/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('trace output failure retains sanitized evidence and removes owned directories', async (context) => {
  const fs = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { runRestoration } = await import('../bench/restoration/run.js');
  const directory = await mkdtemp(join(tmpdir(), 'nx-trace-output-failure-'));
  const output = join(directory, 'result.json');
  const originalWrite = fs.writeFile,
    originalTemp = fs.mkdtemp;

  const owned: string[] = [];

  async function failingWrite(...args: Parameters<typeof fs.writeFile>) {
    const [file] = args;
    if (String(file).endsWith('.trace.json')) {
      throw Object.assign(new Error('private-write-error'), { code: 'ENOSPC' });
    }

    return originalWrite(...args);
  }

  async function recordTemporaryDirectory(...args: Parameters<typeof fs.mkdtemp>) {
    const created = await originalTemp(...args);
    if (String(args[0]).endsWith('restore-')) {
      owned.push(String(created));
    }

    return created;
  }

  context.mock.method(fs, 'writeFile', failingWrite);
  context.mock.method(fs, 'mkdtemp', recordTemporaryDirectory);
  syncBuiltinESMExports();

  try {
    // Early setup failure still has an owned directory and attempts trace output.
    const result = await runRestoration({
      offline: true,
      pairs: 1,
      traceCandidate: true,
      baseline: join(directory, 'absent-bundle.mjs'),
      baselineRevision: 'a'.repeat(40),
      candidateRevision: 'b'.repeat(40),
      output,
    });
    assert.deepEqual(result.failures, ['controller-failure', 'trace-output-failure']);
    assert.equal(owned.length, 1);

    for (const created of owned) {
      await assert.rejects(readdir(created), { code: 'ENOENT' });
    }

    assert.equal(result.preparation.ownedCleanupVerified, true);

    const persisted: unknown = JSON.parse(await readFile(output, 'utf8'));

    assert(
      persisted &&
        typeof persisted === 'object' &&
        'preparation' in persisted &&
        'failures' in persisted,
    );
    assert(
      persisted.preparation &&
        typeof persisted.preparation === 'object' &&
        'ownedCleanupVerified' in persisted.preparation,
    );
    assert.equal(persisted.preparation.ownedCleanupVerified, true);
    assert.deepEqual(persisted.failures, result.failures);
    assert(!JSON.stringify(persisted).includes('private-write-error'));
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(directory, { recursive: true, force: true });
  }
});
