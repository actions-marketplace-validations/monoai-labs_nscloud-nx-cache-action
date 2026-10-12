import { DEFAULT_EXTRACTION_BYTES } from './config.js';
import { ExitCode } from './process-constants.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute } from './execute.js';
import { runCachedCommand } from './cache-command.js';

export interface CacheServer {
  url: string;
  token: string;
  close(): Promise<void>;
}

export async function runWithCache(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  start: () => Promise<CacheServer>,
  strict = true,
): Promise<number> {
  // Native Nx file archives use whole-second mtimes. Never reuse their metadata
  // across commands; only the connector's immutable archive tier is persistent.
  const directory = await mkdtemp(join(tmpdir(), 'nx-namespace-run-'));
  const env: NodeJS.ProcessEnv = {
    ...environment,
    NX_DAEMON: 'false',
    NX_NAMESPACE_CACHE_ACTIVE: 'true',
    NX_WORKSPACE_DATA_DIRECTORY: join(directory, 'workspace-data'),
    NX_CACHE_DIRECTORY: join(directory, 'task-cache'),
    NX_MAX_CACHE_SIZE: environment.NX_CACHE_EXTRACTION_BYTES ?? String(DEFAULT_EXTRACTION_BYTES),
  };
  delete env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER;
  delete env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN;

  try {
    let server: CacheServer;
    try {
      server = await start();
    } catch {
      process.stderr.write('Cache startup failed; caching is disabled for this command\n');
      if (strict) {
        return ExitCode.Failure;
      }

      return await execute(command, args, { ...env, NX_SKIP_NX_CACHE: 'true' });
    }

    return await runCachedCommand(server, command, args, env, { strictPublication: strict });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
