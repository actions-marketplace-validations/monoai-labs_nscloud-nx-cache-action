import { CacheFailureMode } from './config.js';
import { ExitCode } from './process-constants.js';
import { artifactGrant, leaseArtifactToken } from './lease.js';
import { execute } from './execute.js';

export async function runLeasedCommand(
  access: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  issue = leaseArtifactToken,
  run = execute,
): Promise<number> {
  artifactGrant(access);

  const strict = env.NX_CACHE_FAILURE_MODE === CacheFailureMode.Strict;
  let lease: Awaited<ReturnType<typeof leaseArtifactToken>>;
  try {
    lease = await issue(access);
  } catch {
    process.stderr.write('Artifact token issuance failed\n');
    if (strict) {
      return ExitCode.Failure;
    }

    return run(command, args, { ...env, NX_NAMESPACE_TOKEN: '' });
  }

  if (env.GITHUB_ACTIONS === 'true') {
    process.stderr.write(`::add-mask::${lease.bearerToken}\n`);
  }

  let code: number = ExitCode.Success;
  try {
    code = await run(command, args, { ...env, NX_NAMESPACE_TOKEN: lease.bearerToken });
  } finally {
    try {
      await lease.revoke();
    } catch {
      process.stderr.write('Artifact token revocation failed; token expires within one hour\n');
      if (strict) {
        code ||= ExitCode.Failure;
      }
    }
  }

  return code;
}
