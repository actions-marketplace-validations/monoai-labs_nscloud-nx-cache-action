/**
 * Capture archives produced by Nx's native serializer on a loopback endpoint.
 * Both synthetic profile creation and calibrated fixture generation need the same
 * archive format. The callback owns the capture session and restores its environment.
 *
 * Imported by synthetic-profile.ts and fixture.ts; this module is not a command.
 */

import type * as NativeTypes from 'nx/src/native';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { HttpStatus } from '../../src/http.js';

const require = createRequire(import.meta.url);
const { HttpRemoteCache }: typeof NativeTypes = require('nx/src/native');

type StoreArchive = (hash: string, directory: string, terminal: string) => Promise<Buffer>;

export async function withArchiveSerializer<T>(work: (store: StoreArchive) => Promise<T>) {
  const oldServer = process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER;
  const oldToken = process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN;
  const captured: { bytes?: Buffer } = {};
  const listener = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      if (!Buffer.isBuffer(chunk)) {
        throw new Error('Invalid serializer data');
      }

      chunks.push(chunk);
    }

    captured.bytes = Buffer.concat(chunks);
    response.writeHead(HttpStatus.Ok).end();
  });

  try {
    await new Promise<void>((accept, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', accept);
    });
    const address = listener.address();
    if (!address || typeof address === 'string') {
      throw new Error('Missing serializer listener');
    }

    process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = `http://127.0.0.1:${address.port}`;
    process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = 'synthetic-serializer';
    const serializer = new HttpRemoteCache();

    return await work(async (hash, directory, terminal) => {
      delete captured.bytes;
      await serializer.store(hash, directory, terminal, 0);
      if (!captured.bytes) {
        throw new Error('Serializer produced no archive');
      }

      return captured.bytes;
    });
  } finally {
    if (oldServer === undefined) {
      delete process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER;
    } else {
      process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER = oldServer;
    }
    if (oldToken === undefined) {
      delete process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN;
    } else {
      process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN = oldToken;
    }

    if (listener.listening) {
      await new Promise<void>((accept, reject) =>
        listener.close((error) => (error ? reject(error) : accept())),
      );
    }
  }
}
