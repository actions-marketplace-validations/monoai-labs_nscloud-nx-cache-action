/**
 * Qualify Namespace credential permissions and concurrent token leasing.
 * A resolve-only token must be able to read while rejecting publication, and ten
 * simultaneous leases must be issuable for concurrent builds. Issued tokens are
 * revoked in cleanup so the proof does not leave build credentials behind.
 *
 * Run: pnpm exec tsx scripts/credential-proof.ts on the live integration runner.
 * Needs: Namespace credentials allowed to issue and revoke tokens.
 */

import assert from 'node:assert/strict';
import { createIAMClient } from '@namespacelabs/sdk/api/iam';
import { createStorageClient } from '@namespacelabs/sdk/api/storage';
import { createRegionTransport } from '@namespacelabs/sdk/api';
import { fromBearerToken } from '@namespacelabs/sdk/auth';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { credentials } from '../src/credentials.js';
import { randomUUID } from 'node:crypto';
import { leaseArtifactToken, IAM_REQUEST_TIMEOUT_MS } from '../src/lease.js';
import { MINUTE_MS, SECOND_MS } from '../src/units.js';
import { CacheAccess, DEFAULT_ARTIFACT_REGION } from '../src/config.js';
import { ARTIFACT_NAMESPACE, artifactStorageBaseUrl } from '../src/artifact-store.js';
import { ExitCode } from '../src/process-constants.js';

const PROOF_TOKEN_LIFETIME_MS = 10 * MINUTE_MS;
const CONCURRENT_LEASES = 10;

const iam = createIAMClient({ tokenSource: await credentials() });
let tokenId: string | undefined;
try {
  const issued = await iam.tokens.createRevokableToken(
    {
      name: `nx-credential-proof-${randomUUID()}`,
      description: 'Temporary cache permission qualification',
      expiresAt: timestampFromDate(new Date(Date.now() + PROOF_TOKEN_LIFETIME_MS)),
      access: { grants: [{ resourceType: 'artifact', resourceId: '', actions: ['resolve'] }] },
    },
    { timeoutMs: IAM_REQUEST_TIMEOUT_MS },
  );

  tokenId = issued.token?.tokenId;
  if (!tokenId || !issued.bearerToken) {
    throw new Error('Missing issued credential');
  }

  const tokenSource = fromBearerToken(issued.bearerToken);
  const api = createStorageClient({
    tokenSource,
    transport: createRegionTransport(DEFAULT_ARTIFACT_REGION, {
      tokenSource,
      baseUrl: artifactStorageBaseUrl(),
    }),
  }).artifacts;
  const artifactPath = `nx-cache/credential-proof/${tokenId}`;

  await assert.rejects(
    api.resolveArtifact(
      { namespace: ARTIFACT_NAMESPACE, path: artifactPath },
      { timeoutMs: IAM_REQUEST_TIMEOUT_MS },
    ),
    (error) => error instanceof ConnectError && error.code === Code.NotFound,
  );

  await assert.rejects(
    api.createArtifact(
      { namespace: ARTIFACT_NAMESPACE, path: artifactPath },
      { timeoutMs: IAM_REQUEST_TIMEOUT_MS },
    ),
    (error) => error instanceof ConnectError && error.code === Code.PermissionDenied,
  );
  console.log(
    JSON.stringify({
      readAllowed: true,
      writeDenied: true,
      ttlSeconds: PROOF_TOKEN_LIFETIME_MS / SECOND_MS,
    }),
  );

  const leases = await Promise.allSettled(
    Array.from({ length: CONCURRENT_LEASES }, () => leaseArtifactToken(CacheAccess.ReadOnly)),
  );
  try {
    assert.equal(
      leases.filter((result) => result.status === 'fulfilled').length,
      CONCURRENT_LEASES,
    );
    console.log('Ten concurrent build credentials issued');
  } finally {
    await Promise.all(
      leases.map((result) => (result.status === 'fulfilled' ? result.value.revoke() : undefined)),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      credentialProof: 'failed',
      code: error instanceof ConnectError ? error.code : 'assertion',
    }),
  );
  process.exitCode = ExitCode.Failure;
} finally {
  if (tokenId) {
    await iam.tokens.revokeRevokableToken({ tokenId }, { timeoutMs: IAM_REQUEST_TIMEOUT_MS });
    console.log('Temporary credential revoked');
  }
}
