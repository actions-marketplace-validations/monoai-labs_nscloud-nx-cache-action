import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  ARTIFACT_PUBLISH_RETRY_DELAYS_MS,
  ARTIFACT_PUBLISH_RETRY_JITTER,
  artifactStoreFor,
  type ArtifactSpan,
  type IdleScope,
} from '../src/artifact-store.js';
import { HttpStatus } from '../src/http.js';
import { withTemporaryDirectory as sandbox } from './helpers.js';
import {
  createResponse,
  DIGEST_LABEL,
  finalizeResponse,
  resolveResponse,
  scriptedApi,
  uploadServer,
  type ApiScript,
  type UploadReply,
} from './artifact-fakes.js';

const NOMINAL_WAITS_MS = [2000, 5000, 10000];
const LOW_JITTER_WAITS_MS = [1600, 4000, 8000];
const HIGH_JITTER_WAITS_MS = [2400, 6000, 12000];
const MIDPOINT = 0.5;
const JITTER_FRACTION = 0.2;
const EXHAUSTED_ATTEMPTS = NOMINAL_WAITS_MS.length + 1;
const TRANSIENT_CODES = [Code.Internal, Code.Unknown, Code.Unavailable, Code.DeadlineExceeded];
const TRANSIENT_UPLOAD_REPLIES: UploadReply[] = [
  HttpStatus.InternalServerError,
  502,
  HttpStatus.ServiceUnavailable,
  'reset',
];
const PERMANENT_UPLOAD_STATUSES = [400, HttpStatus.Forbidden, HttpStatus.NotFound, 408, 429];
const NON_TRANSIENT_CODES = Object.values(Code).filter(
  (code): code is Code =>
    typeof code === 'number' && !TRANSIENT_CODES.includes(code) && code !== Code.AlreadyExists,
);

type Outcome = { value: boolean } | { error: unknown };

interface PublishOptions {
  replies?: UploadReply[];
  random?: () => number;
  stopRetries?: AbortSignal;
  idle?: IdleScope;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  archive?: 'present' | 'missing';
}

function failure(code: Code, label = 'failure') {
  return new ConnectError(label, code);
}

/** Publishes one archive against the scripted fakes and reports what they observed. */
async function publish(script: (uploadUrl: string) => ApiScript, options: PublishOptions = {}) {
  const upload = await uploadServer(options.replies);
  const waits: number[] = [];
  const spans: ArtifactSpan[] = [];
  const { api, calls } = scriptedApi(script(upload.url));
  const store = artifactStoreFor(api, 'tests/prefix', {
    record: (span) => spans.push(span),
    random: options.random ?? (() => MIDPOINT),
    sleep:
      options.sleep ??
      (async (ms) => {
        waits.push(ms);
      }),
  });
  let outcome: Outcome = { error: new Error('Publication did not run') };

  try {
    await sandbox(async (directory) => {
      const file = join(directory, 'archive');
      if (options.archive !== 'missing') {
        await writeFile(file, 'archive');
      }

      try {
        outcome = {
          value: await store.put('abc', file, {
            ...(options.stopRetries ? { stopRetries: options.stopRetries } : {}),
            ...(options.idle ? { idle: options.idle } : {}),
          }),
        };
      } catch (error) {
        outcome = { error };
      }
    });
  } finally {
    await upload.close();
  }

  return { outcome, calls, waits, spans, uploads: upload.requests() };
}

function created(outcome: Outcome): boolean {
  if (!('value' in outcome)) {
    throw outcome.error;
  }

  return outcome.value;
}

function failedWith(outcome: Outcome): unknown {
  assert('error' in outcome, 'Expected the publication to fail');

  return outcome.error;
}

function retryWaits(spans: ArtifactSpan[]) {
  return spans.filter((span) => span.operation === 'retry-wait');
}

test('the retry limit, waits and jitter are the named constants', () => {
  assert.deepEqual([...ARTIFACT_PUBLISH_RETRY_DELAYS_MS], NOMINAL_WAITS_MS);
  assert.equal(ARTIFACT_PUBLISH_RETRY_JITTER, JITTER_FRACTION);
});

for (const code of TRANSIENT_CODES) {
  test(`${Code[code]} from createArtifact is retried and recovers as a normal success`, async () => {
    const { outcome, calls, waits, spans } = await publish((url) => ({
      create: [failure(code), createResponse('u2', url)],
      finalize: [finalizeResponse()],
    }));

    assert.equal(created(outcome), true);
    assert.equal(calls.create.length, 2);
    assert.deepEqual(waits, [NOMINAL_WAITS_MS[0]]);
    assert.equal(retryWaits(spans).length, 1);
  });
}

for (const reply of TRANSIENT_UPLOAD_REPLIES) {
  const description = reply === 'reset' ? 'a dropped connection' : `HTTP ${reply}`;

  test(`a signed upload answered with ${description} is retried and recovers`, async () => {
    const { outcome, calls, waits, uploads } = await publish(
      (url) => ({
        create: [createResponse('u1', url), createResponse('u2', url)],
        finalize: [finalizeResponse()],
      }),
      { replies: [reply] },
    );

    assert.equal(created(outcome), true);
    assert.equal(calls.create.length, 2);
    assert.equal(uploads, 2);
    assert.equal(calls.finalize.length, 1);
    assert.deepEqual(waits, [NOMINAL_WAITS_MS[0]]);
  });
}

test('a transient failure while confirming an existing artifact is retried', async () => {
  const { outcome, calls, waits } = await publish(() => ({
    create: [failure(Code.AlreadyExists), failure(Code.AlreadyExists)],
    resolve: [failure(Code.Unavailable), resolveResponse([DIGEST_LABEL])],
  }));

  assert.equal(created(outcome), false);
  assert.equal(calls.resolve.length, 2);
  assert.deepEqual(waits, [NOMINAL_WAITS_MS[0]]);
});

test('every other Connect code fails on the first attempt at each stage', async () => {
  for (const code of NON_TRANSIENT_CODES) {
    const error = failure(code);

    const atCreate = await publish(() => ({ create: [error] }));
    assert.equal(failedWith(atCreate.outcome), error, `create ${Code[code]}`);
    assert.equal(atCreate.calls.create.length, 1);
    assert.deepEqual(atCreate.waits, []);

    const atFinalize = await publish((url) => ({
      create: [createResponse('u1', url)],
      finalize: [error],
    }));
    assert.equal(failedWith(atFinalize.outcome), error, `finalize ${Code[code]}`);
    assert.equal(atFinalize.calls.create.length, 1);
    assert.deepEqual(atFinalize.waits, []);

    const atResolve = await publish(() => ({
      create: [failure(Code.AlreadyExists)],
      resolve: [error],
    }));
    assert.equal(failedWith(atResolve.outcome), error, `resolve ${Code[code]}`);
    assert.equal(atResolve.calls.create.length, 1);
    assert.deepEqual(atResolve.waits, []);
  }
});

for (const status of PERMANENT_UPLOAD_STATUSES) {
  test(`a signed upload answered with HTTP ${status} fails on the first attempt`, async () => {
    const { outcome, calls, waits, uploads } = await publish(
      (url) => ({ create: [createResponse('u1', url)] }),
      { replies: [status] },
    );

    assert.match(String(failedWith(outcome)), new RegExp(`Artifact upload failed: HTTP ${status}`));
    assert.equal(calls.create.length, 1);
    assert.equal(uploads, 1);
    assert.deepEqual(waits, []);
  });
}

test('a missing local archive fails on the first attempt', async () => {
  const { outcome, calls, waits } = await publish(
    (url) => ({ create: [createResponse('u1', url)] }),
    { archive: 'missing' },
  );

  const error = failedWith(outcome);
  assert(error instanceof Error && 'code' in error && error.code === 'ENOENT');
  assert.equal(calls.create.length, 1);
  assert.deepEqual(waits, []);
});

test('an archive that becomes unreadable during upload fails on the first attempt', async (context) => {
  const unreadable = new TypeError('fetch failed', {
    cause: new DOMException('The blob could not be read', 'NotReadableError'),
  });
  context.mock.method(globalThis, 'fetch', async () => {
    throw unreadable;
  });

  const { outcome, calls, waits } = await publish((url) => ({
    create: [createResponse('u1', url)],
  }));

  assert.equal(failedWith(outcome), unreadable);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(waits, []);
});

test('publication gives up after three retries and rethrows the final error', async () => {
  const errors = ['first', 'second', 'third', 'fourth'].map((label) =>
    failure(Code.Unavailable, label),
  );

  const { outcome, calls, waits, spans } = await publish(() => ({ create: [...errors] }));

  assert.equal(failedWith(outcome), errors[EXHAUSTED_ATTEMPTS - 1]);
  assert.equal(calls.create.length, EXHAUSTED_ATTEMPTS);
  assert.deepEqual(waits, NOMINAL_WAITS_MS);
  assert.equal(retryWaits(spans).length, NOMINAL_WAITS_MS.length);
});

test('retry waits stay within the jitter fraction of each base wait', async () => {
  const exhausted = () => ({
    create: Array.from({ length: EXHAUSTED_ATTEMPTS }, () => failure(Code.Internal)),
  });

  const low = await publish(exhausted, { random: () => 0 });
  const high = await publish(exhausted, { random: () => 1 });

  assert.deepEqual(low.waits, LOW_JITTER_WAITS_MS);
  assert.deepEqual(high.waits, HIGH_JITTER_WAITS_MS);
});

test('create succeeded but finalize failed: the retry uploads and finalizes a new upload', async () => {
  const { outcome, calls, uploads } = await publish((url) => ({
    create: [createResponse('u1', url), createResponse('u2', url)],
    finalize: [failure(Code.Unavailable), finalizeResponse()],
  }));

  assert.equal(created(outcome), true);
  assert.deepEqual(
    calls.finalize.map((request) => request.uploadId),
    ['u1', 'u2'],
  );
  assert.equal(uploads, 2);
  assert.equal(calls.resolve.length, 0);
});

test('a finalize that landed before its response was lost resolves to the finalized artifact', async () => {
  const { outcome, calls, uploads } = await publish((url) => ({
    create: [createResponse('u1', url), failure(Code.AlreadyExists)],
    finalize: [failure(Code.DeadlineExceeded)],
    resolve: [resolveResponse([DIGEST_LABEL])],
  }));

  assert.equal(created(outcome), false);
  assert.equal(uploads, 1);
  assert.equal(calls.finalize.length, 1);
  assert.equal(calls.resolve.length, 1);
  assert.notEqual(calls.resolve[0]?.metadataOnly, true);
});

test('a retry never reports an unfinalized artifact as published', async () => {
  const unlabeled = await publish((url) => ({
    create: [createResponse('u1', url), failure(Code.AlreadyExists)],
    finalize: [failure(Code.Unavailable)],
    resolve: [resolveResponse([])],
  }));

  assert.match(String(failedWith(unlabeled.outcome)), /Existing artifact is not finalized/);
  assert.equal(unlabeled.calls.create.length, 2);
  assert.deepEqual(unlabeled.waits, [NOMINAL_WAITS_MS[0]]);

  const missing = failure(Code.NotFound);
  const hidden = await publish((url) => ({
    create: [createResponse('u1', url), failure(Code.AlreadyExists)],
    finalize: [failure(Code.Unavailable)],
    resolve: [missing],
  }));

  assert.equal(failedWith(hidden.outcome), missing);
  assert.equal(hidden.calls.create.length, 2);
  assert.deepEqual(hidden.waits, [NOMINAL_WAITS_MS[0]]);
});

test('an existing artifact on the first attempt is still confirmed by a metadata-only resolve', async () => {
  const atCreate = await publish(() => ({
    create: [failure(Code.AlreadyExists)],
    resolve: [resolveResponse([])],
  }));

  assert.equal(created(atCreate.outcome), false);
  assert.equal(atCreate.calls.resolve[0]?.metadataOnly, true);

  const atFinalize = await publish((url) => ({
    create: [createResponse('u1', url)],
    finalize: [failure(Code.AlreadyExists)],
    resolve: [resolveResponse([])],
  }));

  assert.equal(created(atFinalize.outcome), false);
  assert.equal(atFinalize.calls.resolve[0]?.metadataOnly, true);
});

test('aborting stopRetries ends a retry wait and rethrows the last error', async () => {
  const stop = new AbortController();
  const error = failure(Code.Unavailable);
  let waited = false;

  const { outcome, calls } = await publish(() => ({ create: [error] }), {
    stopRetries: stop.signal,
    sleep: (_ms, signal) =>
      new Promise<void>((resolve) => {
        waited = true;
        signal?.addEventListener('abort', () => resolve(), { once: true });
        stop.abort();
      }),
  });

  assert.equal(waited, true);
  assert.equal(failedWith(outcome), error);
  assert.equal(calls.create.length, 1);
});

test('no retry starts once stopRetries has aborted', async () => {
  const stop = new AbortController();
  stop.abort();
  const error = failure(Code.Unavailable);

  const { outcome, calls, waits } = await publish(() => ({ create: [error] }), {
    stopRetries: stop.signal,
  });

  assert.equal(failedWith(outcome), error);
  assert.equal(calls.create.length, 1);
  assert.deepEqual(waits, []);
});

test('each retry wait runs inside the idle scope', async () => {
  const events: string[] = [];

  const { outcome } = await publish(
    (url) => ({
      create: [failure(Code.Internal), createResponse('u2', url)],
      finalize: [finalizeResponse()],
    }),
    {
      idle: async (work) => {
        events.push('idle:start');
        try {
          return await work();
        } finally {
          events.push('idle:end');
        }
      },
      sleep: async () => {
        events.push('sleep');
      },
    },
  );

  assert.equal(created(outcome), true);
  assert.deepEqual(events, ['idle:start', 'sleep', 'idle:end']);
});
