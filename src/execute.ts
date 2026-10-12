import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import {
  ProcessSignal,
  PROCESS_EXISTENCE_PROBE,
  SIGNAL_EXIT_CODE_BASE,
  ExitCode,
} from './process-constants.js';
import { SECOND_MS } from './units.js';

const TERMINATION_GRACE_MS = 3 * SECOND_MS;
const DESCENDANT_POLL_INTERVAL_MS = SECOND_MS / 10;
const DESCENDANT_POLL_ATTEMPTS = TERMINATION_GRACE_MS / DESCENDANT_POLL_INTERVAL_MS;

export async function execute(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  const grouped = process.platform !== 'win32';
  const child = spawn(command, args, { env, stdio: 'inherit', detached: grouped });
  let escalation: ReturnType<typeof setTimeout> | undefined;

  function signal(signal: NodeJS.Signals) {
    if (!child.pid) {
      return;
    }

    try {
      if (grouped) {
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
        throw error;
      }
    }
  }

  function terminate(signalName: NodeJS.Signals) {
    signal(signalName);
    escalation ??= setTimeout(() => signal(ProcessSignal.Kill), TERMINATION_GRACE_MS);
  }

  const interrupt = () => terminate(ProcessSignal.Interrupt);
  const stop = () => terminate(ProcessSignal.Terminate);
  process.on(ProcessSignal.Interrupt, interrupt);
  process.on(ProcessSignal.Terminate, stop);

  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) =>
        resolve(
          code ?? (signal ? SIGNAL_EXIT_CODE_BASE + constants.signals[signal] : ExitCode.Failure),
        ),
      );
    });

    // The owned group may still contain a grandchild after the direct child exits.
    signal(ProcessSignal.Terminate);
    if (grouped && child.pid) {
      const pid = child.pid;
      for (let i = 0; i < DESCENDANT_POLL_ATTEMPTS; i++) {
        try {
          process.kill(-pid, PROCESS_EXISTENCE_PROBE);
        } catch {
          return code;
        }

        await new Promise((resolve) => setTimeout(resolve, DESCENDANT_POLL_INTERVAL_MS));
      }

      signal(ProcessSignal.Kill);
    }

    return code;
  } finally {
    if (escalation) {
      clearTimeout(escalation);
    }
    process.off(ProcessSignal.Interrupt, interrupt);
    process.off(ProcessSignal.Terminate, stop);
  }
}
