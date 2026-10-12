import { SECOND_MS, MINUTE_MS, DAY_MS } from './units.js';
import { HttpMethod } from './http.js';
import { createStorageClient } from '@namespacelabs/sdk/api/storage';
import { createRegionTransport } from '@namespacelabs/sdk/api';
import { Code, ConnectError } from '@connectrpc/connect';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { createReadStream, openAsBlob } from 'node:fs';
import { createHash } from 'node:crypto';
import { credentials } from './credentials.js';
import { DEFAULT_ARTIFACT_REGION } from './config.js';
import { validateHash } from './local-store.js';
import type { CacheTrace } from './trace.js';

export const ARTIFACT_REQUEST_TIMEOUT_MS = 30 * SECOND_MS;
export const ARTIFACT_TRANSFER_TIMEOUT_MS = MINUTE_MS;
export const ARTIFACT_NAMESPACE = 'main';
const ARTIFACT_STORAGE_DOMAIN = 'storage.namespaceapis.com';
const ARTIFACT_RETENTION_MS = 7 * DAY_MS;

export interface RemoteStore {
  get(hash: string, signal?: AbortSignal): Promise<AsyncIterable<Uint8Array> | null>;
  put(hash: string, file: string): Promise<boolean>;
}

export interface ArtifactSpan {
  operation: string;
  hash: string;
  durationMs: number;
}

export function artifactStorageBaseUrl(region = DEFAULT_ARTIFACT_REGION): string {
  return `https://${region}.${ARTIFACT_STORAGE_DOMAIN}`;
}

export async function createArtifactStore(
  prefix: string,
  region = DEFAULT_ARTIFACT_REGION,
  record?: (span: ArtifactSpan) => void,
  trace?: CacheTrace,
): Promise<RemoteStore> {
  if (!/^[a-zA-Z0-9/_-]+$/.test(prefix) || prefix.includes('..')) {
    throw new Error('Invalid artifact prefix');
  }
  if (!/^[a-z0-9-]+$/.test(region)) {
    throw new Error('Invalid region');
  }

  const tokenSource = await credentials();
  const transport = createRegionTransport(region, {
    tokenSource,
    baseUrl: artifactStorageBaseUrl(region),
  });
  const api = createStorageClient({ tokenSource, transport }).artifacts;

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
            (label) => label.name === 'artifact.digest.sha256',
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

    async put(hash, file) {
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
          await resolveExisting(hash);
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
        throw new Error(`Artifact upload failed: HTTP ${response.status}`);
      }

      try {
        await timed('finalize', hash, () =>
          api.finalizeArtifact(
            {
              uploadId: upload.uploadId,
              addLabels: [{ name: 'artifact.digest.sha256', value: digest.digest('hex') }],
            },
            { timeoutMs: ARTIFACT_REQUEST_TIMEOUT_MS },
          ),
        );
      } catch (error) {
        if (!(error instanceof ConnectError && error.code === Code.AlreadyExists)) {
          throw error;
        }

        await resolveExisting(hash);
        return false;
      }

      return true;
    },
  };
}
