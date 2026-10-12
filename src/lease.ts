import { CacheAccess } from './config.js';
import { HOUR_MS, SECOND_MS } from './units.js';
import { createIAMClient } from '@namespacelabs/sdk/api/iam';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { credentials } from './credentials.js';
import { randomUUID } from 'node:crypto';

const BUILD_TOKEN_LIFETIME_MS = HOUR_MS;
export const IAM_REQUEST_TIMEOUT_MS = 15 * SECOND_MS;

export function artifactGrant(access: string) {
  if (access !== CacheAccess.ReadOnly && access !== CacheAccess.ReadWrite) {
    throw new Error('Expected read-only or read-write');
  }

  return {
    resourceType: 'artifact',
    resourceId: '',
    actions: access === CacheAccess.ReadOnly ? ['resolve'] : ['resolve', 'create'],
  };
}

export async function leaseArtifactToken(access: string) {
  const grant = artifactGrant(access);
  const iam = createIAMClient({ tokenSource: await credentials() });
  const result = await iam.tokens.createRevokableToken(
    {
      name: `nx-build-${process.env.GITHUB_RUN_ID ?? 'local'}-${randomUUID()}`,
      description: 'Build-only Artifact cache access',
      expiresAt: timestampFromDate(new Date(Date.now() + BUILD_TOKEN_LIFETIME_MS)),
      access: { grants: [grant] },
    },
    { timeoutMs: IAM_REQUEST_TIMEOUT_MS },
  );
  const tokenId = result.token?.tokenId;
  if (!tokenId || !result.bearerToken) {
    if (tokenId) {
      await iam.tokens.revokeRevokableToken({ tokenId }, { timeoutMs: IAM_REQUEST_TIMEOUT_MS });
    }

    throw new Error('Missing build credential');
  }

  return {
    bearerToken: result.bearerToken,
    revoke: () =>
      iam.tokens.revokeRevokableToken({ tokenId }, { timeoutMs: IAM_REQUEST_TIMEOUT_MS }),
  };
}
