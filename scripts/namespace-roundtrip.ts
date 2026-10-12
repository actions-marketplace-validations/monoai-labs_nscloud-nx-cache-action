/**
 * Verify publication and restoration against live Namespace Artifact Storage.
 * Concurrent writes must select one immutable winner, unfinished uploads must stay
 * invisible, and write/verify modes check persistence across separate jobs even
 * when the writer job later fails.
 *
 * Run: pnpm exec tsx scripts/namespace-roundtrip.ts [concurrent|write|verify].
 * Needs: Namespace credentials and a dedicated NX_ARTIFACT_PREFIX shared by those jobs.
 * Writes: short-lived test Artifacts and results/publication-*.json.
 */

import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import {
  createArtifactStore,
  ARTIFACT_REQUEST_TIMEOUT_MS,
  ARTIFACT_TRANSFER_TIMEOUT_MS,
  ARTIFACT_NAMESPACE,
  artifactStorageBaseUrl,
} from '../src/artifact-store.js';
import { DEFAULT_ARTIFACT_REGION } from '../src/config.js';
import { LocalStore } from '../src/local-store.js';
import { credentials } from '../src/credentials.js';
import { createStorageClient } from '@namespacelabs/sdk/api/storage';
import { createRegionTransport } from '@namespacelabs/sdk/api';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { DAY_MS } from '../src/units.js';
import { NODE_USER_ARGUMENT_OFFSET } from '../src/process-constants.js';
import { HttpMethod } from '../src/http.js';

const PublicationProofMode = Object.freeze({
  Concurrent: 'concurrent',
  Write: 'write',
  Verify: 'verify',
});
const UNFINISHED_ARTIFACT_LIFETIME_MS = DAY_MS;

const prefix = process.env.NX_ARTIFACT_PREFIX;
if (!prefix) {
  throw new Error('Isolated artifact prefix required');
}

const remote = await createArtifactStore(prefix);
const dir = await mkdtemp(join(tmpdir(), 'artifact-proof-'));
try {
  const content = 'Namespace cache publication proof\n';
  const file = join(dir, 'archive');
  await writeFile(file, content);

  const mode = process.argv[NODE_USER_ARGUMENT_OFFSET] ?? PublicationProofMode.Concurrent;
  const result: Record<string, unknown> = { mode };
  if (mode === PublicationProofMode.Concurrent) {
    const tokenSource = await credentials();
    const transport = createRegionTransport(DEFAULT_ARTIFACT_REGION, {
      tokenSource,
      baseUrl: artifactStorageBaseUrl(),
    });
    const api = createStorageClient({ tokenSource, transport }).artifacts;

    const unfinished = await api.createArtifact(
      {
        namespace: ARTIFACT_NAMESPACE,
        path: `${prefix}/unfinished`,
        createNewVersionIfExists: false,
        expiresAt: timestampFromDate(new Date(Date.now() + UNFINISHED_ARTIFACT_LIFETIME_MS)),
      },
      { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
    );

    const body = new Blob([content]);
    const upload = await fetch(unfinished.signedUploadUrl, {
      method: HttpMethod.Put,
      body,
      headers: { 'Content-Length': String(body.size) },
      signal: AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS),
    });
    assert(upload.ok);

    assert.equal(await remote.get('unfinished'), null, 'Unfinalized upload became visible');
    result.unfinishedUploadInvisible = true;

    const writes = await Promise.allSettled([
      remote.put('concurrent', file),
      remote.put('concurrent', file),
    ]);
    result.writes = writes.map((item) =>
      item.status === 'fulfilled'
        ? { status: item.status, created: item.value }
        : {
            status: item.status,
            error: item.reason instanceof Error ? item.reason.name : 'unknown',
            code: item.reason instanceof Error && 'code' in item.reason ? item.reason.code : null,
          },
    );

    await mkdir('results', { recursive: true });
    await writeFile('results/concurrent-attempt.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));

    assert.equal(
      writes.filter((item) => item.status === 'fulfilled' && item.value === true).length,
      1,
    );
    assert.equal(
      writes.filter((item) => item.status === 'fulfilled' && item.value === false).length,
      1,
    );
  } else if (mode === PublicationProofMode.Write) {
    await remote.put('failed-job', file);
  }

  const hash = mode === PublicationProofMode.Concurrent ? 'concurrent' : 'failed-job';
  const stream = await remote.get(hash);
  assert(stream);
  const stored = await new LocalStore(join(dir, 'read')).receive(hash, stream);
  assert.equal(await readFile(stored.file, 'utf8'), content);
  result.restored = true;

  await mkdir('results', { recursive: true });
  await writeFile(`results/publication-${mode}.json`, JSON.stringify(result, null, 2));

  console.log(JSON.stringify(result));
} finally {
  await rm(dir, { recursive: true, force: true });
}
