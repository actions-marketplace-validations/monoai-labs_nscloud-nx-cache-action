import { CacheMetrics } from './metrics.js';
import { runWithCache } from './command.js';
import { startConfiguredServer } from './runtime.js';
import { appendCacheSummary } from './summary.js';
import { NODE_USER_ARGUMENT_OFFSET } from './process-constants.js';
import { CacheFailureMode } from './config.js';

const args = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
const command = args.shift();
if (!command) {
  throw new Error('Expected command after nscloud-nx-cache-action');
}

const strict = process.env.NX_CACHE_FAILURE_MODE === CacheFailureMode.Strict;
const metrics = new CacheMetrics();
const exitCode = await runWithCache(
  command,
  args,
  process.env,
  () => startConfiguredServer(process.env, metrics.record),
  strict,
);

await appendCacheSummary(process.env.GITHUB_STEP_SUMMARY, metrics.snapshot());
process.exitCode = exitCode;
