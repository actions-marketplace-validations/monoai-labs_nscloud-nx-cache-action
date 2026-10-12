import { ProcessSignal, ExitCode } from './process-constants.js';
import { execute } from './execute.js';

export async function runCachedCommand(
  server: { url: string; token: string; close(): Promise<void> },
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  options: { strictPublication?: boolean } = {},
): Promise<number> {
  let code: number = ExitCode.Success;
  const interrupt = () => {
    code = ExitCode.Interrupted;
  };
  const terminate = () => {
    code = ExitCode.Terminated;
  };

  process.on(ProcessSignal.Interrupt, interrupt);
  process.on(ProcessSignal.Terminate, terminate);

  try {
    try {
      const childCode = await execute(command, args, {
        ...env,
        NX_SELF_HOSTED_REMOTE_CACHE_SERVER: server.url,
        NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: server.token,
      });
      code ||= childCode;
    } finally {
      try {
        await server.close();
      } catch {
        process.stderr.write('Cache publication failed during shutdown\n');
        if (options.strictPublication !== false) {
          code ||= ExitCode.Failure;
        }
      }
    }

    return code;
  } finally {
    process.off(ProcessSignal.Interrupt, interrupt);
    process.off(ProcessSignal.Terminate, terminate);
  }
}
