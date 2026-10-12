import { HttpMethod, HttpStatus } from './http.js';
import { MINUTE_MS, SECOND_MS } from './units.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RemoteStore } from './artifact-store.js';
import { CacheIntegrityError, type LocalStore } from './local-store.js';
import type { RecordEvent } from './metrics.js';
import { errorCode, CacheOperation, CacheTier } from './metrics.js';
import { PublicationQueue } from './publication-queue.js';
import type { CacheTrace } from './trace.js';

const DEFAULT_REQUEST_CONCURRENCY = 32;
const DEFAULT_REQUEST_QUEUE_CAPACITY = 128;
const DEFAULT_QUEUE_WAIT_MS = 2 * MINUTE_MS;
const DEFAULT_REQUEST_DEADLINE_MS = 2 * MINUTE_MS;
const HTTP_REQUEST_TIMEOUT_MS = 2 * MINUTE_MS;
const HTTP_HEADERS_TIMEOUT_MS = 10 * SECOND_MS;
const SOCKET_IDLE_TIMEOUT_MS = 2 * MINUTE_MS;
const EXTRA_CONNECTION_CAPACITY = 16;
const MAX_REQUESTS_PER_SOCKET = 100;
const AUTH_TOKEN_BYTES = 32;

type Admission = 'admitted' | 'overload' | 'cancelled';

function untilAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );

    if (signal.aborted) {
      abort();
    }
  });
}

export async function startServer(options: {
  local: LocalStore;
  remote?: RemoteStore;
  record: RecordEvent;
  trace?: CacheTrace;
  readOnly?: boolean;
  remoteReadOnly?: boolean;
  backgroundPublication?: boolean;
  failOpen?: boolean;
  maxConcurrentRequests?: number;
  maxQueuedRequests?: number;
  queueWaitMs?: number;
  requestDeadlineMs?: number;
}) {
  const maxConcurrentRequests = options.maxConcurrentRequests ?? DEFAULT_REQUEST_CONCURRENCY;
  const maxQueuedRequests = options.maxQueuedRequests ?? DEFAULT_REQUEST_QUEUE_CAPACITY;
  const queueWaitMs = options.queueWaitMs ?? DEFAULT_QUEUE_WAIT_MS;
  const requestDeadlineMs = options.requestDeadlineMs ?? DEFAULT_REQUEST_DEADLINE_MS;

  if (!Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests < 1) {
    throw new Error('Invalid request concurrency');
  }
  if (!Number.isSafeInteger(maxQueuedRequests) || maxQueuedRequests < 0) {
    throw new Error('Invalid request queue capacity');
  }
  if (!Number.isSafeInteger(queueWaitMs) || queueWaitMs < 1) {
    throw new Error('Invalid queue wait deadline');
  }
  if (!Number.isSafeInteger(requestDeadlineMs) || requestDeadlineMs < 1) {
    throw new Error('Invalid request deadline');
  }

  const token = randomBytes(AUTH_TOKEN_BYTES).toString('hex');
  const expectedAuth = Buffer.from(`Bearer ${token}`);

  const pending = new Set<Promise<void>>();
  const publications = new PublicationQueue();
  let active = 0;
  const waiting: { admit: (result: Admission) => void; cancelled: boolean }[] = [];

  function release(): void {
    active--;
    while (waiting.length) {
      const next = waiting.shift();
      if (next && !next.cancelled) {
        active++;
        next.admit('admitted');
        break;
      }
    }
  }

  function admit(req: IncomingMessage, res: ServerResponse): Promise<Admission> {
    if (active < maxConcurrentRequests) {
      active++;
      return Promise.resolve('admitted');
    }

    if (waiting.length >= maxQueuedRequests) {
      return Promise.resolve('overload');
    }

    return new Promise((resolve) => {
      let settled = false;
      const item = { cancelled: false, admit: (result: Admission) => finish(result) };
      const timer = setTimeout(() => finish('overload'), queueWaitMs);
      const onClose = () => finish('cancelled');

      function finish(result: Admission) {
        if (settled) {
          return;
        }

        settled = true;
        item.cancelled = result !== 'admitted';
        clearTimeout(timer);
        req.off('aborted', onClose);
        res.off('close', onClose);

        if (item.cancelled) {
          const index = waiting.indexOf(item);
          if (index >= 0) {
            waiting.splice(index, 1);
          }
        }

        resolve(result);
      }

      req.once('aborted', onClose);
      res.once('close', onClose);
      waiting.push(item);
    });
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = performance.now();
    const match = /^\/v1\/cache\/([a-zA-Z0-9_-]{1,128})$/.exec(req.url ?? '');
    const hash = match?.[1];
    if (!hash) {
      res.writeHead(HttpStatus.NotFound).end();
      return;
    }

    const authorization = Buffer.from(req.headers.authorization ?? '');
    if (
      authorization.length !== expectedAuth.length ||
      !timingSafeEqual(authorization, expectedAuth)
    ) {
      res.writeHead(HttpStatus.Unauthorized).end();
      return;
    }

    return options.trace
      ? options.trace.request(hash, () => serve(req, res, hash, started))
      : serve(req, res, hash, started);
  }

  async function serve(
    req: IncomingMessage,
    res: ServerResponse,
    hash: string,
    started: number,
  ): Promise<void> {
    const operation = req.method === HttpMethod.Get ? CacheOperation.Get : CacheOperation.Put;
    const queueFinished = options.trace?.begin('request.queue');
    const admission = await admit(req, res);
    queueFinished?.();

    if (admission !== 'admitted') {
      if (admission === 'overload') {
        options.record({
          operation,
          tier: CacheTier.Overload,
          hash,
          durationMs: performance.now() - started,
        });

        if (!res.destroyed) {
          res
            .writeHead(
              options.failOpen
                ? operation === CacheOperation.Get
                  ? HttpStatus.NotFound
                  : HttpStatus.Ok
                : HttpStatus.ServiceUnavailable,
              {
                Connection: 'close',
              },
            )
            .end();
        }
      }

      return;
    }

    const controller = new AbortController();
    const deadline = setTimeout(
      () => controller.abort(new DOMException('Cache request deadline', 'TimeoutError')),
      requestDeadlineMs,
    );
    const disconnected = () => {
      if (!res.writableEnded) {
        controller.abort(new DOMException('Cache client disconnected', 'AbortError'));
      }
    };
    const stopUpload = () => {
      if (req.method === HttpMethod.Put && !req.complete) {
        req.destroy();
      }
    };

    req.once('aborted', disconnected);
    res.once('close', disconnected);
    controller.signal.addEventListener('abort', stopUpload, { once: true });

    try {
      if (req.method === HttpMethod.Get) {
        let file = await untilAbort(
          options.local.get(hash, (error) =>
            options.record({
              operation,
              tier: CacheTier.Corrupt,
              hash,
              errorCode: errorCode(error),
              durationMs: performance.now() - started,
            }),
          ),
          controller.signal,
        );
        let tier: 'local' | 'artifact' | 'miss' = file ? CacheTier.Local : CacheTier.Miss;

        if (!file && options.remote) {
          let stream: AsyncIterable<Uint8Array> | null;
          try {
            stream = await untilAbort(
              options.remote.get(hash, controller.signal),
              controller.signal,
            );
          } catch (error) {
            if (controller.signal.aborted) {
              throw error;
            }

            options.record({
              operation: CacheOperation.Remote,
              tier: CacheTier.Unavailable,
              hash,
              errorCode: errorCode(error),
              durationMs: performance.now() - started,
            });

            if (!options.failOpen) {
              throw error;
            }

            res.writeHead(HttpStatus.NotFound).end();
            return;
          }

          if (stream) {
            file = (
              await untilAbort(
                options.local.receive(hash, stream, controller.signal),
                controller.signal,
              )
            ).file;
            tier = CacheTier.Artifact;
          }
        }

        if (!file) {
          options.record({ operation, tier, hash, durationMs: performance.now() - started });
          res.writeHead(HttpStatus.NotFound).end();
          return;
        }

        const info = await untilAbort(stat(file), controller.signal);
        if (info.size < 1) {
          throw new CacheIntegrityError('Empty archive');
        }

        res.writeHead(HttpStatus.Ok, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': info.size,
        });

        // End with the advertised body, without a redundant EOF read after the peer can close.
        const responseFinished = options.trace?.begin('response.stream');
        try {
          await pipeline(createReadStream(file, { end: info.size - 1 }), res, {
            signal: controller.signal,
          });
        } finally {
          responseFinished?.({ bytes: info.size });
        }

        options.record({
          operation,
          tier,
          hash,
          bytes: info.size,
          durationMs: performance.now() - started,
        });
      } else if (req.method === HttpMethod.Put) {
        if (options.readOnly) {
          options.record({
            operation,
            tier: CacheTier.ReadOnly,
            hash,
            durationMs: performance.now() - started,
          });
          res.writeHead(HttpStatus.Forbidden, { Connection: 'close' }).end();
          return;
        }

        const length = req.headers['content-length'];
        if (length !== undefined && Number(length) > options.local.maxBytes) {
          res.writeHead(HttpStatus.PayloadTooLarge, { Connection: 'close' }).end();
          return;
        }

        const stored = await untilAbort(
          options.local.receive(hash, req, controller.signal),
          controller.signal,
        );
        let created = stored.created;
        const remote = options.remoteReadOnly ? undefined : options.remote;
        const uploadBytes = remote ? (await stat(stored.file)).size : 0;

        if (options.remote && options.remoteReadOnly) {
          options.record({
            operation: CacheOperation.Publish,
            tier: CacheTier.Policy,
            hash,
            durationMs: performance.now() - started,
          });
        }

        const publish = async () => {
          const publishStarted = performance.now();
          if (remote) {
            try {
              created = await remote.put(hash, stored.file);
              if (!created && stored.created) {
                await options.local.remove(hash);
                const canonical = await remote.get(hash);
                if (!canonical) {
                  throw new Error('Existing artifact is not finalized');
                }

                await options.local.receive(hash, canonical);
              }
            } catch (error) {
              if (!options.failOpen && stored.created) {
                await options.local.remove(hash);
              }

              options.record({
                operation: CacheOperation.Publish,
                tier: options.failOpen ? CacheTier.Unavailable : CacheTier.Error,
                hash,
                errorCode: errorCode(error),
                durationMs: performance.now() - publishStarted,
              });

              throw error;
            }
          }

          if (remote) {
            options.record({
              operation: CacheOperation.Publish,
              tier: created ? CacheTier.Artifact : CacheTier.AlreadyPresent,
              hash,
              bytes: created ? uploadBytes : 0,
              durationMs: performance.now() - publishStarted,
            });
          }
        };

        try {
          if (remote && options.backgroundPublication) {
            await publications.add(hash, publish);
          } else {
            await publish();
          }
        } catch (error) {
          if (!options.failOpen) {
            throw error;
          }
        }

        options.record({
          operation,
          tier: CacheTier.Local,
          hash,
          bytes: stored.bytes,
          durationMs: performance.now() - started,
        });
        res.writeHead(created ? HttpStatus.Ok : HttpStatus.Conflict).end();
      } else {
        res.writeHead(HttpStatus.MethodNotAllowed).end();
      }
    } catch (error) {
      options.record({
        operation,
        tier: CacheTier.Error,
        hash,
        errorCode: errorCode(error),
        durationMs: performance.now() - started,
      });

      if (!res.destroyed && !res.headersSent) {
        res
          .writeHead(
            options.failOpen
              ? operation === CacheOperation.Get
                ? HttpStatus.NotFound
                : HttpStatus.Ok
              : controller.signal.aborted
                ? HttpStatus.ServiceUnavailable
                : HttpStatus.InternalServerError,
          )
          .end();
      } else if (!res.destroyed) {
        res.destroy();
      }
    } finally {
      clearTimeout(deadline);
      req.off('aborted', disconnected);
      res.off('close', disconnected);
      controller.signal.removeEventListener('abort', stopUpload);
      release();
    }
  }

  const server = createServer((req, res) => {
    const task = handle(req, res);
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  server.requestTimeout = HTTP_REQUEST_TIMEOUT_MS;
  server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;
  server.maxConnections = maxConcurrentRequests + maxQueuedRequests + EXTRA_CONNECTION_CAPACITY;
  server.maxRequestsPerSocket = MAX_REQUESTS_PER_SOCKET;
  server.setTimeout(SOCKET_IDLE_TIMEOUT_MS, (socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Missing listener address');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    token,
    drain: () => publications.drain(),
    async close() {
      const closing = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );

      await Promise.all(pending);
      server.closeIdleConnections();
      await closing;

      if (server.listening) {
        throw new Error('Listener still running');
      }

      await publications.drain();
    },
  };
}
