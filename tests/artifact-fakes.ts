/**
 * Scripted Artifact Storage fakes for publication tests. The API fake answers each
 * call from a queue of responses or errors, and the upload server stands in for the
 * signed upload URL so `fetch` fails with real HTTP statuses and dropped connections.
 * Both fail the test when called more often than scripted.
 */

import { createServer } from 'node:http';
import type { ArtifactApi } from '../src/artifact-store.js';
import { HttpStatus } from '../src/http.js';

type CreateRequest = Parameters<ArtifactApi['createArtifact']>[0];
type FinalizeRequest = Parameters<ArtifactApi['finalizeArtifact']>[0];
type ResolveRequest = Parameters<ArtifactApi['resolveArtifact']>[0];
type CreateResponse = Awaited<ReturnType<ArtifactApi['createArtifact']>>;
type FinalizeResponse = Awaited<ReturnType<ArtifactApi['finalizeArtifact']>>;
type ResolveResponse = Awaited<ReturnType<ArtifactApi['resolveArtifact']>>;

export type Outcome<T> = T | Error;

export interface ApiScript {
  create?: Outcome<CreateResponse>[];
  finalize?: Outcome<FinalizeResponse>[];
  resolve?: Outcome<ResolveResponse>[];
}

export const DIGEST_LABEL = 'artifact.digest.sha256';

export function createResponse(uploadId: string, signedUploadUrl: string): CreateResponse {
  return {
    $typeName: 'namespace.cloud.storage.v1beta.CreateArtifactResponse',
    signedUploadUrl,
    uploadId,
  };
}

export function finalizeResponse(): FinalizeResponse {
  return { $typeName: 'namespace.cloud.storage.v1beta.FinalizeArtifactResponse' };
}

/** A resolved artifact record carrying the given label names. */
export function resolveResponse(labelNames: string[]): ResolveResponse {
  return {
    $typeName: 'namespace.cloud.storage.v1beta.ResolveArtifactResponse',
    signedDownloadUrl: '',
    description: {
      $typeName: 'namespace.cloud.storage.v1beta.Artifact',
      id: 'artifact',
      path: 'tests/prefix/abc',
      namespace: 'main',
      labels: labelNames.map((name) => ({
        $typeName: 'namespace.stdlib.Label',
        name,
        value: 'value',
      })),
      size: 0n,
      webUrl: '',
      status: 1,
    },
  };
}

function consume<T>(name: string, outcomes: Outcome<T>[] = []): T {
  const next = outcomes.shift();
  if (next === undefined) {
    throw new Error(`Unexpected ${name} call`);
  }
  if (next instanceof Error) {
    throw next;
  }

  return next;
}

export function scriptedApi(script: ApiScript) {
  const calls: {
    create: CreateRequest[];
    finalize: FinalizeRequest[];
    resolve: ResolveRequest[];
  } = { create: [], finalize: [], resolve: [] };
  const api: ArtifactApi = {
    async createArtifact(request) {
      calls.create.push(request);

      return consume('create', script.create);
    },
    async finalizeArtifact(request) {
      calls.finalize.push(request);

      return consume('finalize', script.finalize);
    },
    async resolveArtifact(request) {
      calls.resolve.push(request);

      return consume('resolve', script.resolve);
    },
  };

  return { api, calls };
}

export type UploadReply = number | 'reset';

/** Answers each upload with the next reply (an HTTP status, or a dropped connection), then 200. */
export async function uploadServer(replies: UploadReply[] = []) {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    const reply = replies.shift() ?? HttpStatus.Ok;
    if (reply === 'reset') {
      req.socket.destroy();

      return;
    }

    req.resume();
    req.on('end', () => res.writeHead(reply).end());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing listener address');
  }

  return {
    url: `http://127.0.0.1:${address.port}/upload`,
    requests: () => requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
