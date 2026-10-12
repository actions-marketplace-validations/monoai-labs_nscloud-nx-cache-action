import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactGrant } from '../src/lease.js';
import { runLeasedCommand } from '../src/leased-command.js';

test('build credentials permit only the selected Artifact actions', () => {
  assert.deepEqual(artifactGrant('read-only'), {
    resourceType: 'artifact',
    resourceId: '',
    actions: ['resolve'],
  });
  assert.deepEqual(artifactGrant('read-write'), {
    resourceType: 'artifact',
    resourceId: '',
    actions: ['resolve', 'create'],
  });
  assert.throws(() => artifactGrant('admin'));
});

test('issuer outage runs the deployment once without a token unless strict', async () => {
  let calls = 0;
  const issue = async () => {
    throw new Error('offline');
  };
  const run = async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
    calls++;
    assert.equal(env.NX_NAMESPACE_TOKEN, '');

    return 7;
  };

  assert.equal(await runLeasedCommand('read-only', 'deploy', [], {}, issue, run), 7);
  assert.equal(calls, 1);

  assert.equal(
    await runLeasedCommand(
      'read-only',
      'deploy',
      [],
      { NX_CACHE_FAILURE_MODE: 'strict' },
      issue,
      run,
    ),
    1,
  );
  assert.equal(calls, 1);
});

test('revocation runs after deployment and preserves its failure', async () => {
  let revoked = false;
  const issue = async () => ({
    bearerToken: 'scoped-test-token',
    revoke: async () => {
      revoked = true;

      throw new Error('offline');
    },
  });
  const run = async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
    assert.equal(env.NX_NAMESPACE_TOKEN, 'scoped-test-token');

    return 7;
  };

  assert.equal(await runLeasedCommand('read-only', 'deploy', [], {}, issue, run), 7);
  assert.ok(revoked);

  assert.equal(await runLeasedCommand('read-only', 'deploy', [], {}, issue, async () => 0), 0);
});
