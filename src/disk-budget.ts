import { FilePermissions } from './filesystem.js';
import { HOUR_MS } from './units.js';
import { lstat, readdir, rm, statfs, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CacheTrace } from './trace.js';

const STALE_PARTIAL_AGE_MS = HOUR_MS;
const INVENTORY_SCAN_CONCURRENCY = 16;

function disappeared(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** One instance owns admission for a connector's archive directory. */
export class DiskBudget {
  private reserved = 0;
  private admission: Promise<void> = Promise.resolve();

  constructor(
    readonly directory: string,
    readonly bytes: number,
    private readonly trace?: CacheTrace,
  ) {
    if (!Number.isSafeInteger(bytes) || bytes < 1) {
      throw new Error('Invalid disk budget');
    }
  }

  private async entries() {
    const names = await readdir(this.directory);
    const entries = [];

    const inspect = async (name: string) => {
      const entry = join(this.directory, name);
      try {
        const info = await lstat(entry);
        if (/^\.tmp-[a-zA-Z0-9_-]+$/.test(name)) {
          if (Date.now() - info.mtimeMs > STALE_PARTIAL_AGE_MS) {
            await rm(entry, { recursive: true, force: true });
          }

          return undefined;
        }

        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(name) || !info.isDirectory()) {
          return undefined;
        }

        let size = 0;
        for (const child of await readdir(entry)) {
          size += (await lstat(join(entry, child))).size;
        }

        return { entry, size, modified: info.mtimeMs };
      } catch (error) {
        // Atomic publication and removal can invalidate a directory snapshot.
        // Its active upload remains covered by the in-flight reservation.
        if (!disappeared(error)) {
          throw error;
        }

        return undefined;
      }
    };

    for (let offset = 0; offset < names.length; offset += INVENTORY_SCAN_CONCURRENCY) {
      // Retain directory order for LRU ties and drain this batch before unlocking
      // admission on failure; stale-partial cleanup must not outlive the scan.
      const batch = await Promise.allSettled(
        names.slice(offset, offset + INVENTORY_SCAN_CONCURRENCY).map(inspect),
      );
      for (const result of batch) {
        if (result.status === 'rejected') {
          throw result.reason;
        }

        if (result.value) {
          entries.push(result.value);
        }
      }
    }

    return entries.sort((a, b) => a.modified - b.modified);
  }

  async reserve(bytes: number): Promise<() => void> {
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > this.bytes) {
      throw new Error('Invalid disk reservation');
    }

    const previous = this.admission;
    let unlock = () => {};
    this.admission = new Promise<void>((resolve) => {
      unlock = resolve;
    });

    const queueFinished = this.trace?.begin('disk.queue');
    await previous;
    queueFinished?.();

    try {
      await mkdir(this.directory, { recursive: true, mode: FilePermissions.OwnerOnlyDirectory });

      const pendingBytes = this.reserved;
      const scanFinished = this.trace?.begin('disk.scan');
      let entries: Awaited<ReturnType<DiskBudget['entries']>>;
      try {
        entries = await this.entries();
      } finally {
        scanFinished?.();
      }

      let total = entries.reduce((sum, entry) => sum + entry.size, 0);
      for (const entry of entries) {
        if (total + pendingBytes + bytes <= this.bytes) {
          break;
        }

        const evictionFinished = this.trace?.begin('disk.evict');
        try {
          await rm(entry.entry, { recursive: true, force: true });
        } finally {
          evictionFinished?.({ bytes: entry.size });
        }

        total -= entry.size;
      }

      if (total + pendingBytes + bytes > this.bytes) {
        throw new Error('Cache disk budget exhausted');
      }

      const statfsFinished = this.trace?.begin('disk.statfs');
      const disk = await statfs(this.directory).finally(() =>
        statfsFinished?.({ entries: entries.length, reservedBytes: pendingBytes + bytes }),
      );
      if (disk.bavail * disk.bsize < this.reserved + bytes) {
        throw new Error('Insufficient cache disk space');
      }

      this.reserved += bytes;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.reserved -= bytes;
        }
      };
    } finally {
      unlock();
    }
  }
}
