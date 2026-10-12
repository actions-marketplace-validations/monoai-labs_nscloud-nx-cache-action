import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { execute } from '../src/execute.js';
import { ProcessSignal, PROCESS_EXISTENCE_PROBE } from '../src/process-constants.js';
import { SECOND_MS } from '../src/units.js';

const KEEP_ALIVE_INTERVAL_MS = SECOND_MS;

const CHILD_EXECUTION_TIMEOUT_MS = SECOND_MS;
const WRAPPER_STARTUP_TIMEOUT_MS = 10 * SECOND_MS;
const OWNED_PROCESS_POLL_INTERVAL_MS = 50;
const DESCENDANT_DISCOVERY_ATTEMPTS = 100;
const DESCENDANT_REAP_ATTEMPTS = 50;

test('child exit code preserved', async () =>
  assert.equal(await execute(process.execPath, ['-e', 'process.exit(7)'], process.env), 7));

test('wrapper exits when its execution deadline sends termination', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nx-deadline-'));
  const wrapper = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      resolve('src/run.ts'),
      process.execPath,
      '-e',
      `process.stdout.write('ready\\n'); setInterval(() => {}, ${KEEP_ALIVE_INTERVAL_MS})`,
    ],
    {
      env: { ...process.env, NX_ARCHIVE_DIRECTORY: join(dir, 'cache') },
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );

  const done = once(wrapper, 'exit');
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    assert(wrapper.stdout);
    await once(wrapper.stdout, 'data', { signal: AbortSignal.timeout(WRAPPER_STARTUP_TIMEOUT_MS) });

    deadline = setTimeout(() => wrapper.kill(ProcessSignal.Terminate), CHILD_EXECUTION_TIMEOUT_MS);
    const [code, signal] = await done;
    assert.equal(code, 143);
    assert.equal(signal, null);
    assert(wrapper.pid);
    assert.throws(() => process.kill(wrapper.pid ?? 0, PROCESS_EXISTENCE_PROBE));
  } finally {
    clearTimeout(deadline);
    if (wrapper.exitCode === null && wrapper.signalCode === null) {
      wrapper.kill(ProcessSignal.Kill);
      await done;
    }

    await rm(dir, { recursive: true, force: true });
  }
});

test('wrapper preserves command failure while appending its cache summary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-summary-exit-'));
  const summary = join(directory, 'summary.md');
  const wrapper = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('src/run.ts'), process.execPath, '-e', 'process.exit(7)'],
    {
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summary,
        NX_ARCHIVE_DIRECTORY: join(directory, 'cache'),
      },
      stdio: 'ignore',
    },
  );

  try {
    const [code] = await once(wrapper, 'exit');
    assert.equal(code, 7);
    assert.match(await readFile(summary, 'utf8'), /### Nx cache operations/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('cancellation removes stubborn owned descendant', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nx-lifecycle-'));
  const pidFile = join(dir, 'pid');
  const descendantCode = `
const fs = require('node:fs');
process.on(${JSON.stringify(ProcessSignal.Terminate)}, () => {});
fs.writeFileSync(${JSON.stringify(`${pidFile}.tmp`)}, String(process.pid));
fs.renameSync(${JSON.stringify(`${pidFile}.tmp`)}, ${JSON.stringify(pidFile)});
setInterval(() => {}, ${KEEP_ALIVE_INTERVAL_MS});
`;
  const code = `
const { spawn } = require('node:child_process');
spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], { stdio: 'ignore' });
setInterval(() => {}, ${KEEP_ALIVE_INTERVAL_MS});
`;

  const wrapper = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('src/run.ts'), process.execPath, '-e', code],
    { env: { ...process.env, NX_ARCHIVE_DIRECTORY: join(dir, 'cache') }, stdio: 'ignore' },
  );

  let descendant = 0;
  try {
    for (let i = 0; i < DESCENDANT_DISCOVERY_ATTEMPTS; i++) {
      try {
        descendant = Number(await readFile(pidFile, 'utf8'));

        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, OWNED_PROCESS_POLL_INTERVAL_MS));
      }
    }

    assert(descendant > 0);

    const done = once(wrapper, 'exit');

    wrapper.kill(ProcessSignal.Terminate);

    const [code] = await done;
    assert.equal(code, 143);

    let alive = true;
    for (let i = 0; i < DESCENDANT_REAP_ATTEMPTS; i++) {
      try {
        process.kill(descendant, PROCESS_EXISTENCE_PROBE);
      } catch {
        alive = false;

        break;
      }

      await new Promise((resolve) => setTimeout(resolve, OWNED_PROCESS_POLL_INTERVAL_MS));
    }

    assert.equal(alive, false);
  } finally {
    if (wrapper.exitCode === null && wrapper.signalCode === null) {
      wrapper.kill(ProcessSignal.Kill);
      await once(wrapper, 'exit');
    }

    if (descendant) {
      try {
        process.kill(descendant, ProcessSignal.Kill);
      } catch {}
    }

    await rm(dir, { recursive: true, force: true });
  }
});
