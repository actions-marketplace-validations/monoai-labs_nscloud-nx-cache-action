import { FilePermissions, FileOpenMode } from './filesystem.js';
import {
  DEFAULT_MAX_ARCHIVE_BYTES,
  DEFAULT_RETENTION_MS,
  DEFAULT_LOCAL_DISK_BYTES,
  MAX_ARCHIVE_METADATA_BYTES,
} from './config.js';
import { mkdir, open, lstat, rename, rm, utimes } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DiskBudget } from './disk-budget.js';
import type { CacheTrace } from './trace.js';

const DISPLACED_ARCHIVE_RESTORE_ATTEMPTS = 3;
const ARCHIVE_METADATA_VERSION = 1;

export function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

export function validateHash(hash: string): void {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(hash)) {
    throw new Error('Invalid cache hash');
  }
}

export class CacheIntegrityError extends Error {}

interface ArchiveMetadata {
  version: typeof ARCHIVE_METADATA_VERSION;
  bytes: number;
  digest: string;
  createdAt: number;
}

export interface LocalStoreOptions {
  trace?: CacheTrace;
  maxArchiveBytes?: number;
  maxAgeMs?: number;
  maxDiskBytes?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseArchiveMetadata(value: unknown): ArchiveMetadata {
  if (!isRecord(value)) {
    throw new CacheIntegrityError('Invalid archive metadata');
  }

  const { version, bytes, digest, createdAt } = value;
  const validVersion = version === ARCHIVE_METADATA_VERSION;
  const validBytes = typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes > 0;
  const validDigest = typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest);
  const validCreatedAt = typeof createdAt === 'number' && Number.isSafeInteger(createdAt);
  if (!validVersion || !validBytes || !validDigest || !validCreatedAt) {
    throw new CacheIntegrityError('Invalid archive metadata');
  }

  return { version, bytes, digest, createdAt };
}

async function syncDirectory(directory: string, trace?: CacheTrace): Promise<void> {
  if (process.platform === 'win32') {
    return;
  }

  const handle = await open(directory, FileOpenMode.Read);
  const finished = trace?.begin('local.directory-fsync');
  try {
    await handle.sync();
  } finally {
    await handle.close();
    finished?.();
  }
}

export class LocalStore {
  readonly directory: string;
  readonly maxBytes: number;
  readonly maxAgeMs: number;
  private readonly budget: DiskBudget;
  private readonly trace: CacheTrace | undefined;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(directory: string, options: number | LocalStoreOptions = {}) {
    const config = typeof options === 'number' ? { maxArchiveBytes: options } : options;
    this.directory = join(directory, 'entries-v1');
    this.maxBytes = config.maxArchiveBytes ?? DEFAULT_MAX_ARCHIVE_BYTES;
    this.maxAgeMs = config.maxAgeMs ?? DEFAULT_RETENTION_MS;
    this.trace = config.trace;
    this.budget = new DiskBudget(
      this.directory,
      config.maxDiskBytes ?? DEFAULT_LOCAL_DISK_BYTES,
      this.trace,
    );

    if (
      !Number.isSafeInteger(this.maxBytes) ||
      this.maxBytes < 1 ||
      !Number.isSafeInteger(this.maxAgeMs) ||
      this.maxAgeMs < 1
    ) {
      throw new Error('Invalid local store limits');
    }
  }

  private async withHashLock<T>(hash: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(hash) ?? Promise.resolve();
    let unlock = () => {};
    const current = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    this.locks.set(hash, current);

    const lockFinished = this.trace?.begin('local.hash-lock');
    await previous;
    lockFinished?.();

    try {
      return await work();
    } finally {
      if (this.locks.get(hash) === current) {
        this.locks.delete(hash);
      }

      unlock();
    }
  }

  async get(
    hash: string,
    onCorrupt?: (error: CacheIntegrityError) => void,
  ): Promise<string | null> {
    validateHash(hash);

    const finished = this.trace?.begin('local.lookup');
    try {
      return await this.withHashLock(hash, () => this.getUnlocked(hash, onCorrupt));
    } finally {
      finished?.();
    }
  }

  private async getUnlocked(
    hash: string,
    onCorrupt?: (error: CacheIntegrityError) => void,
  ): Promise<string | null> {
    const entry = join(this.directory, hash);
    let observed: Awaited<ReturnType<typeof lstat>> | undefined;
    try {
      const directoryInfo = await lstat(entry);
      observed = directoryInfo;
      if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
        throw new CacheIntegrityError('Invalid archive directory');
      }

      const metadataFile = join(entry, 'metadata.json');
      const metadataInfo = await lstat(metadataFile);
      if (
        !metadataInfo.isFile() ||
        metadataInfo.isSymbolicLink() ||
        metadataInfo.size > MAX_ARCHIVE_METADATA_BYTES
      ) {
        throw new CacheIntegrityError('Invalid archive metadata file');
      }

      let details: ArchiveMetadata;
      const metadataFinished = this.trace?.begin('local.metadata');
      try {
        const description = await open(
          metadataFile,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        try {
          details = parseArchiveMetadata(JSON.parse(await description.readFile('utf8')));
        } finally {
          await description.close();
        }
      } catch {
        throw new CacheIntegrityError('Invalid archive metadata');
      } finally {
        metadataFinished?.();
      }

      if (Date.now() - details.createdAt > this.maxAgeMs) {
        await this.removeObserved(entry, directoryInfo);
        return null;
      }

      const file = join(entry, 'archive');
      const info = await lstat(file);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size !== details.bytes ||
        info.size > this.maxBytes
      ) {
        throw new CacheIntegrityError('Archive size mismatch');
      }

      const digest = createHash('sha256');
      const archive = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const verificationFinished = this.trace?.begin('local.verify');
      try {
        for await (const chunk of archive.createReadStream()) {
          digest.update(chunk);
        }
      } finally {
        await archive.close();
        verificationFinished?.({ bytes: info.size });
      }

      if (digest.digest('hex') !== details.digest) {
        throw new CacheIntegrityError('Archive digest mismatch');
      }

      const now = new Date();
      const touchFinished = this.trace?.begin('local.touch');
      try {
        await utimes(entry, now, now);
      } finally {
        touchFinished?.();
      }

      return file;
    } catch (error) {
      if (isCode(error, 'ENOENT')) {
        if (observed) {
          await this.removeObserved(entry, observed);
          onCorrupt?.(new CacheIntegrityError('Incomplete archive entry'));
        }

        return null;
      }

      if (error instanceof CacheIntegrityError) {
        if (observed) {
          await this.removeObserved(entry, observed);
        }

        onCorrupt?.(error);
        return null;
      }

      throw error;
    }
  }

  private async removeObserved(
    entry: string,
    observed: Awaited<ReturnType<typeof lstat>>,
  ): Promise<void> {
    let current: Awaited<ReturnType<typeof lstat>>;
    try {
      current = await lstat(entry);
    } catch (error) {
      if (isCode(error, 'ENOENT')) {
        return;
      }

      throw error;
    }

    if (current.dev !== observed.dev || current.ino !== observed.ino) {
      return;
    }

    const quarantine = join(this.directory, `.tmp-corrupt-${randomUUID()}`);
    try {
      await rename(entry, quarantine);
    } catch (error) {
      if (isCode(error, 'ENOENT')) {
        return;
      }

      throw error;
    }

    const moved = await lstat(quarantine);
    if (moved.dev !== observed.dev || moved.ino !== observed.ino) {
      // Another connector replaced the entry between inspection and rename.
      // Put its valid candidate back; never delete an inode we did not inspect.
      for (let attempt = 0; attempt < DISPLACED_ARCHIVE_RESTORE_ATTEMPTS; attempt++) {
        try {
          await rename(quarantine, entry);
          return;
        } catch (error) {
          if (!isCode(error, 'EEXIST') && !isCode(error, 'ENOTEMPTY')) {
            throw error;
          }

          // A further publisher won the canonical path. Only discard the
          // displaced entry after validating that winner.
          if (await this.getUnlocked(basename(entry))) {
            await rm(quarantine, { recursive: true, force: true });
            return;
          }
        }
      }

      throw new CacheIntegrityError('Could not restore displaced archive');
    }

    await rm(quarantine, { recursive: true, force: true });
  }

  async remove(hash: string): Promise<void> {
    validateHash(hash);

    await this.withHashLock(hash, () =>
      rm(join(this.directory, hash), { recursive: true, force: true }),
    );
  }

  async receive(
    hash: string,
    chunks: AsyncIterable<Uint8Array>,
    signal?: AbortSignal,
  ): Promise<{ file: string; created: boolean; bytes: number }> {
    validateHash(hash);

    await mkdir(this.directory, { recursive: true });

    const entry = join(this.directory, hash);
    const partial = join(this.directory, `.tmp-${hash}-${randomUUID()}`);
    const received = this.trace?.begin('local.receive');
    let release: (() => void) | undefined;
    try {
      release = await this.budget.reserve(this.maxBytes + MAX_ARCHIVE_METADATA_BYTES);
      await mkdir(partial, { mode: FilePermissions.OwnerOnlyDirectory });

      const handle = await open(
        join(partial, 'archive'),
        FileOpenMode.ExclusiveWrite,
        FilePermissions.OwnerOnlyFile,
      );
      let bytes = 0;
      const digest = createHash('sha256');
      try {
        for await (const chunk of chunks) {
          if (signal?.aborted) {
            throw signal.reason;
          }

          bytes += chunk.length;
          if (bytes > this.maxBytes) {
            throw new Error('Archive exceeds byte limit');
          }

          digest.update(chunk);
          const writeFinished = this.trace?.begin('local.write');
          try {
            await handle.writeFile(chunk);
          } finally {
            writeFinished?.({ bytes: chunk.length, chunks: 1 });
          }
        }

        if (signal?.aborted) {
          throw signal.reason;
        }
        if (!bytes) {
          throw new CacheIntegrityError('Empty archive');
        }

        const syncFinished = this.trace?.begin('local.fsync');
        try {
          await handle.sync();
        } finally {
          syncFinished?.({ bytes });
        }

        await handle.close();

        const details: ArchiveMetadata = {
          version: ARCHIVE_METADATA_VERSION,
          bytes,
          digest: digest.digest('hex'),
          createdAt: Date.now(),
        };
        const description = await open(
          join(partial, 'metadata.json'),
          FileOpenMode.ExclusiveWrite,
          FilePermissions.OwnerOnlyFile,
        );
        try {
          const writeFinished = this.trace?.begin('local.metadata-write');
          try {
            await description.writeFile(JSON.stringify(details));
          } finally {
            writeFinished?.();
          }

          const syncFinished = this.trace?.begin('local.metadata-fsync');
          try {
            await description.sync();
          } finally {
            syncFinished?.();
          }
        } finally {
          await description.close();
        }

        await syncDirectory(partial, this.trace);

        const committed = this.trace?.begin('local.commit');
        try {
          return await this.withHashLock(hash, async () => {
            const canonical = await this.getUnlocked(hash);
            if (canonical) {
              return { file: canonical, created: false, bytes };
            }

            try {
              await rename(partial, entry);
            } catch (error) {
              if (!isCode(error, 'EEXIST') && !isCode(error, 'ENOTEMPTY')) {
                throw error;
              }

              const winner = await this.getUnlocked(hash);
              if (winner) {
                return { file: winner, created: false, bytes };
              }

              // Another connector may have found and removed a corrupt entry.
              try {
                await rename(partial, entry);
              } catch (retryError) {
                if (!isCode(retryError, 'EEXIST') && !isCode(retryError, 'ENOTEMPTY')) {
                  throw retryError;
                }

                const replacement = await this.getUnlocked(hash);
                if (replacement) {
                  return { file: replacement, created: false, bytes };
                }

                throw retryError;
              }
            }

            await syncDirectory(this.directory, this.trace);

            return { file: join(entry, 'archive'), created: true, bytes };
          });
        } finally {
          committed?.();
        }
      } finally {
        await handle.close();
        await rm(partial, { recursive: true, force: true });
      }
    } finally {
      release?.();
      received?.();
    }
  }
}
