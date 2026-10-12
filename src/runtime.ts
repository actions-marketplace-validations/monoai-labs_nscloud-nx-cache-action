import { createArtifactStore, type RemoteStore } from './artifact-store.js';
import { configuration, DEFAULT_ARTIFACT_REGION } from './config.js';
import { LocalStore } from './local-store.js';
import { errorCode, type RecordEvent, CacheOperation, CacheTier } from './metrics.js';
import { startServer } from './server.js';
import { CacheTrace, writeTrace } from './trace.js';

export async function startConfiguredServer(
  env: NodeJS.ProcessEnv,
  record: RecordEvent,
  remoteFactory?: (prefix: string, region: string) => Promise<RemoteStore>,
) {
  const config = configuration(env);
  const trace = env.NX_CACHE_TRACE === '1' ? new CacheTrace(writeTrace) : undefined;
  const local = new LocalStore(config.directory, { ...config, ...(trace ? { trace } : {}) });

  let remote: RemoteStore | undefined;
  const prefix = env.NX_ARTIFACT_PREFIX;
  if (prefix) {
    const region = env.NX_ARTIFACT_REGION ?? DEFAULT_ARTIFACT_REGION;
    try {
      remote = await (remoteFactory
        ? remoteFactory(prefix, region)
        : createArtifactStore(prefix, region, undefined, trace));
    } catch (error) {
      if (config.strict) {
        throw error;
      }

      record({
        operation: CacheOperation.Remote,
        tier: CacheTier.Unavailable,
        hash: 'startup',
        durationMs: 0,
        errorCode: errorCode(error),
      });
    }
  }

  return startServer({
    local,
    ...(remote ? { remote } : {}),
    readOnly: config.readOnly,
    remoteReadOnly: config.remoteReadOnly,
    backgroundPublication: true,
    failOpen: !config.strict,
    record,
    ...(trace ? { trace } : {}),
  });
}
