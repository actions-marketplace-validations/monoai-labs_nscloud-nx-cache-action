import { runLeasedCommand } from './leased-command.js';
import { NODE_USER_ARGUMENT_OFFSET } from './process-constants.js';

const [access, command, ...args] = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
if (!access || !command) {
  throw new Error('Expected access mode followed by command');
}

process.exitCode = await runLeasedCommand(access, command, args, process.env);
