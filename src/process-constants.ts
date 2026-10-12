import { constants } from 'node:os';

export const ProcessSignal = Object.freeze({
  Interrupt: 'SIGINT',
  Terminate: 'SIGTERM',
  Kill: 'SIGKILL',
}) satisfies Record<string, NodeJS.Signals>;

export const PROCESS_EXISTENCE_PROBE = 0;
export const NODE_USER_ARGUMENT_OFFSET = 2;
export const SIGNAL_EXIT_CODE_BASE = 128;
export const ExitCode = Object.freeze({
  Success: 0,
  Failure: 1,
  Interrupted: SIGNAL_EXIT_CODE_BASE + constants.signals.SIGINT,
  Terminated: SIGNAL_EXIT_CODE_BASE + constants.signals.SIGTERM,
});
