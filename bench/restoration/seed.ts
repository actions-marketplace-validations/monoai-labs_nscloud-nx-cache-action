/**
 * Publish and verify synthetic corpus archives beneath a benchmark-owned prefix.
 * Remote measurements need finalized, digest-checked objects before client timing
 * starts. A recorded publication inventory and three-hour expiration bound the
 * test's remote state and expose partial preparation on failure.
 *
 * Called by run.ts with Namespace credentials; this module is not a command.
 */

import { createStorageClient } from '@namespacelabs/sdk/api/storage';
import { createRegionTransport } from '@namespacelabs/sdk/api';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { openAsBlob } from 'node:fs';
import { credentials } from '../../src/credentials.js';
import {
  createArtifactStore,
  ARTIFACT_REQUEST_TIMEOUT_MS,
  ARTIFACT_TRANSFER_TIMEOUT_MS,
} from '../../src/artifact-store.js';
import { validateHash } from '../../src/local-store.js';
import { createHash } from 'node:crypto';
import { HOUR_MS } from '../../src/units.js';
import { SEED_EXPIRATION_HOURS } from './benchmark-policy.js';
import { HttpMethod } from '../../src/http.js';

interface SeedInventory {
  hash: string;
  bytes: number;
  expiresAt: string;
  stage: 'created' | 'uploaded' | 'finalized' | 'verified';
}

export async function seedFixtures(
  prefix: string,
  fixtures: { hash: string; file: string; digest: string; bytes: number }[],
  region = 'ord',
  recordInventory?: (inventory: SeedInventory[]) => Promise<void>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (!/^nx-cache\/benchmark-restoration\/[a-zA-Z0-9_-]+\/[a-f0-9]{64}$/.test(prefix)) {
    throw new Error('Invalid benchmark-owned prefix');
  }

  for (const fixture of fixtures) {
    validateHash(fixture.hash);
    if (
      !/^[a-f0-9]{64}$/.test(fixture.digest) ||
      !Number.isSafeInteger(fixture.bytes) ||
      fixture.bytes < 1
    ) {
      throw new Error('Invalid synthetic fixture');
    }
  }

  const tokenSource = await credentials();
  const transport = createRegionTransport(region, {
    tokenSource,
    baseUrl: `https://${region}.storage.namespaceapis.com`,
  });
  const api = createStorageClient({ tokenSource, transport }).artifacts;

  const expiresAt = new Date(Date.now() + SEED_EXPIRATION_HOURS * HOUR_MS);
  const inventory: SeedInventory[] = [];

  for (const fixture of fixtures) {
    signal?.throwIfAborted();
    const path = `${prefix}/${fixture.hash}`;
    const upload = await api.createArtifact(
      {
        namespace: 'main',
        path,
        createNewVersionIfExists: false,
        expiresAt: timestampFromDate(expiresAt),
      },
      { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS, ...(signal ? { signal } : {}) },
    );

    const entry: SeedInventory = {
      hash: fixture.hash,
      bytes: fixture.bytes,
      expiresAt: expiresAt.toISOString(),
      stage: 'created',
    };
    inventory.push(entry);
    await recordInventory?.(structuredClone(inventory));

    const body = await openAsBlob(fixture.file);
    const response = await fetch(upload.signedUploadUrl, {
      method: HttpMethod.Put,
      body,
      headers: { 'Content-Length': String(body.size) },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS)])
        : AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Synthetic seed HTTP ${response.status}`);
    }

    entry.stage = 'uploaded';
    await recordInventory?.(structuredClone(inventory));
    await api.finalizeArtifact(
      {
        uploadId: upload.uploadId,
        addLabels: [{ name: 'artifact.digest.sha256', value: fixture.digest }],
      },
      { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
    );
    entry.stage = 'finalized';
    await recordInventory?.(structuredClone(inventory));
  }

  const remote = await createArtifactStore(prefix, region);
  for (const fixture of fixtures) {
    signal?.throwIfAborted();
    const stream = await remote.get(fixture.hash, signal);
    if (!stream) {
      throw new Error('Synthetic seed absent');
    }

    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of stream) {
      digest.update(chunk);
      bytes += chunk.length;
    }

    if (bytes !== fixture.bytes || digest.digest('hex') !== fixture.digest) {
      throw new Error('Synthetic seed proof failed');
    }

    const entry = inventory.find((value) => value.hash === fixture.hash);
    if (!entry) {
      throw new Error('Missing owned seed inventory');
    }

    entry.stage = 'verified';
    await recordInventory?.(structuredClone(inventory));
  }

  return { inventory, finalizedAndVerified: true, expirationHours: SEED_EXPIRATION_HOURS };
}
