import { SECOND_MS, MINUTE_MS, DAY_MS } from './units.js';
import { HttpMethod, HttpStatus } from './http.js';
import { createStorageClient, type StorageClient } from '@namespacelabs/sdk/api/storage';
import { createRegionTransport } from '@namespacelabs/sdk/api';
import { Code, ConnectError } from '@connectrpc/connect';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createReadStream, openAsBlob } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { credentials } from './credentials.js';
import { DEFAULT_ARTIFACT_REGION } from './config.js';
import { validateHash } from './local-store.js';
import type { CacheTrace } from './trace.js';

export const ARTIFACT_REQUEST_TIMEOUT_MS = 30 * SECOND_MS;
export const ARTIFACT_TRANSFER_TIMEOUT_MS = MINUTE_MS;
export const ARTIFACT_NAMESPACE = 'main';
// One entry per retry after the first attempt; the length is the retry limit.
export const ARTIFACT_PUBLISH_RETRY_DELAYS_MS = Object.freeze([
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
]);
// Each wait is scaled by a random factor within this fraction of 1.
export const ARTIFACT_PUBLISH_RETRY_JITTER = 0.2;
const ARTIFACT_STORAGE_DOMAIN = 'storage.namespaceapis.com';
const ARTIFACT_RETENTION_MS = 7 * DAY_MS;
const ARTIFACT_DIGEST_LABEL = 'artifact.digest.sha256';
const TRANSIENT_RPC_CODES: ReadonlySet<Code> = new Set([
  Code.Internal,
  Code.Unknown,
  Code.Unavailable,
  Code.DeadlineExceeded,
]);

/** A scope that releases a scarce resource for the duration of `work`. */
export type IdleScope = <T>(work: () => Promise<T>) => Promise<T>;

const runWithoutIdling: IdleScope = (work) => work();

export interface PublishOptions {
  /** Aborting ends a retry wait and stops further attempts; an attempt in progress finishes. */
  stopRetries?: AbortSignal;
  /** Wraps each retry wait so the caller can release queue capacity while it sleeps. */
  idle?: IdleScope;
}

export interface RemoteStore {
  get(hash: string, signal?: AbortSignal): Promise<AsyncIterable<Uint8Array> | null>;
  put(hash: string, file: string, options?: PublishOptions): Promise<boolean>;
}

export type ArtifactApi = Pick<
  StorageClient['artifacts'],
  'createArtifact' | 'finalizeArtifact' | 'resolveArtifact'
>;

export interface ArtifactStoreOptions {
  record?: (span: ArtifactSpan) => void;
  trace?: CacheTrace;
  /** Resolves after `ms`, or as soon as the signal aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Source of retry jitter in [0, 1). */
  random?: () => number;
}

class ArtifactUploadError extends Error {
  constructor(readonly status: number) {
    super(`Artifact upload failed: HTTP ${status}`);
  }
}

async function sleepUnlessAborted(ms: number, signal?: AbortSignal): Promise<void> {
  try {
    await pause(ms, undefined, signal ? { signal } : {});
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
  }
}

function isTransientPublishError(error: unknown): boolean {
  if (error instanceof ConnectError) {
    return TRANSIENT_RPC_CODES.has(error.code);
  }
  if (error instanceof ArtifactUploadError) {
    return error.status >= HttpStatus.InternalServerError;
  }

  // Undici reports connection-level failures as `TypeError: fetch failed`. A blob that
  // can no longer be read from disk fails the same way and is a local error.
  return (
    error instanceof TypeError &&
    error.message === 'fetch failed' &&
    !(error.cause instanceof DOMException && error.cause.name === 'NotReadableError')
  );
}

export interface ArtifactSpan {
  operation: string;
  hash: string;
  durationMs: number;
}

export function artifactStorageBaseUrl(region = DEFAULT_ARTIFACT_REGION): string {
  return `https://${region}.${ARTIFACT_STORAGE_DOMAIN}`;
}

function assertPrefix(prefix: string): void {
  if (!/^[a-zA-Z0-9/_-]+$/.test(prefix) || prefix.includes('..')) {
    throw new Error('Invalid artifact prefix');
  }
}

export async function createArtifactStore(
  prefix: string,
  region = DEFAULT_ARTIFACT_REGION,
  record?: (span: ArtifactSpan) => void,
  trace?: CacheTrace,
): Promise<RemoteStore> {
  assertPrefix(prefix);
  if (!/^[a-z0-9-]+$/.test(region)) {
    throw new Error('Invalid region');
  }

  const tokenSource = await credentials();
  const transport = createRegionTransport(region, {
    tokenSource,
    baseUrl: artifactStorageBaseUrl(region),
  });
  const api = createStorageClient({ tokenSource, transport }).artifacts;

  return artifactStoreFor(api, prefix, {
    ...(record ? { record } : {}),
    ...(trace ? { trace } : {}),
  });
}

export function artifactStoreFor(
  api: ArtifactApi,
  prefix: string,
  options: ArtifactStoreOptions = {},
): RemoteStore {
  assertPrefix(prefix);

  const { record, trace } = options;
  const sleep = options.sleep ?? sleepUnlessAborted;
  const random = options.random ?? Math.random;

  async function timed<T>(operation: string, hash: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const finished =
      operation === 'resolve'
        ? trace?.begin('artifact.resolve')
        : operation === 'download-headers'
          ? trace?.begin('artifact.headers')
          : undefined;
    try {
      return await work();
    } finally {
      finished?.();
      record?.({ operation, hash, durationMs: performance.now() - start });
    }
  }

  function path(hash: string) {
    validateHash(hash);
    return `${prefix}/${hash}`;
  }

  function resolveExisting(hash: string) {
    return api.resolveArtifact(
      { namespace: ARTIFACT_NAMESPACE, path: path(hash), metadataOnly: true },
      { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
    );
  }

  // A retry can meet the artifact its own earlier attempt created. A full resolve hides
  // unfinalized uploads and finalization attaches the digest label, so require both
  // before treating the artifact as published.
  async function resolveFinalized(hash: string) {
    const existing = await api.resolveArtifact(
      { namespace: ARTIFACT_NAMESPACE, path: path(hash) },
      { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
    );
    if (!existing.description?.labels.some((label) => label.name === ARTIFACT_DIGEST_LABEL)) {
      throw new Error('Existing artifact is not finalized');
    }
  }

  async function publishOnce(hash: string, file: string, retried: boolean): Promise<boolean> {
    const confirmExisting = retried ? resolveFinalized : resolveExisting;

    let upload;
    try {
      upload = await timed('create', hash, () =>
        api.createArtifact(
          {
            namespace: ARTIFACT_NAMESPACE,
            path: path(hash),
            createNewVersionIfExists: false,
            expiresAt: timestampFromDate(new Date(Date.now() + ARTIFACT_RETENTION_MS)),
          },
          { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
        ),
      );
    } catch (error) {
      if (error instanceof ConnectError && error.code === Code.AlreadyExists) {
        await confirmExisting(hash);
        return false;
      }

      throw error;
    }

    const digest = createHash('sha256');
    for await (const chunk of createReadStream(file)) {
      digest.update(chunk);
    }

    const body = await openAsBlob(file);
    const response = await timed('upload', hash, () =>
      fetch(upload.signedUploadUrl, {
        method: HttpMethod.Put,
        body,
        headers: { 'Content-Length': String(body.size) },
        signal: AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS),
      }),
    );
    if (!response.ok) {
      throw new ArtifactUploadError(response.status);
    }

    try {
      await timed('finalize', hash, () =>
        api.finalizeArtifact(
          {
            uploadId: upload.uploadId,
            addLabels: [{ name: ARTIFACT_DIGEST_LABEL, value: digest.digest('hex') }],
          },
          { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
        ),
      );
    } catch (error) {
      if (!(error instanceof ConnectError && error.code === Code.AlreadyExists)) {
        throw error;
      }

      await confirmExisting(hash);
      return false;
    }

    return true;
  }

  return {
    async get(hash, signal) {
      let artifact;
      try {
        artifact = await timed('resolve', hash, () =>
          api.resolveArtifact(
            { namespace: ARTIFACT_NAMESPACE, path: path(hash) },
            { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS, ...(signal ? { signal } : {}) },
          ),
        );
      } catch (error) {
        if (error instanceof ConnectError && error.code === Code.NotFound) {
          return null;
        }

        throw error;
      }

      const downloadSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS)])
        : AbortSignal.timeout(ARTIFACT_TRANSFER_TIMEOUT_MS);
      const response = await timed('download-headers', hash, () =>
        fetch(artifact.signedDownloadUrl, { signal: downloadSignal }),
      );
      if (!response.ok || !response.body) {
        throw new Error(`Artifact download failed: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();

      return (async function* () {
        let bytes = 0n;
        const digest = createHash('sha256');
        const bodyFinished = trace?.begin('artifact.body');
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) {
              break;
            }

            bytes += BigInt(next.value.length);
            digest.update(next.value);
            yield next.value;
          }

          const expected = artifact.description?.labels.find(
            (label) => label.name === ARTIFACT_DIGEST_LABEL,
          )?.value;
          if (
            bytes !== artifact.description?.size ||
            !expected ||
            digest.digest('hex') !== expected
          ) {
            throw new Error('Artifact integrity mismatch');
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
          bodyFinished?.({ bytes: Number(bytes) });
        }
      })();
    },

    async put(hash, file, { stopRetries, idle = runWithoutIdling } = {}) {
      for (let retry = 0; ; retry++) {
        try {
          return await publishOnce(hash, file, retry > 0);
        } catch (error) {
          const baseDelay = ARTIFACT_PUBLISH_RETRY_DELAYS_MS[retry];
          if (baseDelay === undefined || !isTransientPublishError(error) || stopRetries?.aborted) {
            throw error;
          }

          const jitter = 1 + ARTIFACT_PUBLISH_RETRY_JITTER * (2 * random() - 1);
          const wait = Math.round(baseDelay * jitter);
          await timed('retry-wait', hash, () => idle(() => sleep(wait, stopRetries)));
          if (stopRetries?.aborted) {
            throw error;
          }
        }
      }
    },
  };
}
