import { existsSync } from 'node:fs';
import {
  fromBearerToken,
  loadDefaults,
  loadWorkloadToken,
  type TokenSource,
} from '@namespacelabs/sdk/auth';

const WORKLOAD_TOKEN_FILE = '/var/run/nsc/token.json';

export async function credentials(): Promise<TokenSource> {
  if (process.env.NX_NAMESPACE_TOKEN) {
    return fromBearerToken(process.env.NX_NAMESPACE_TOKEN);
  }

  if (existsSync(WORKLOAD_TOKEN_FILE)) {
    return {
      async issueToken(duration) {
        return (await loadWorkloadToken()).issueToken(duration);
      },
    };
  }

  return loadDefaults();
}
