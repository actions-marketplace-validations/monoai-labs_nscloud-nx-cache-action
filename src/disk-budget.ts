import { FilePermissions, FileOpenMode } from './filesystem.js';
import { HOUR_MS } from './units.js';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, rm, statfs, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { CacheTrace } from './trace.js';

const STALE_PARTIAL_AGE_MS = HOUR_MS;
const SWEEP_INTERVAL_MS = HOUR_MS;
const INVENTORY_SCAN_CONCURRENCY = 16;
export const INVENTORY_FILE = '.inventory.json';
const INVENTORY_VERSION = 1;
const MAX_INVENTORY_FILE_BYTES = 1024;

function disappeared(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Stored bytes found by the sweep at `scannedAt`, plus what has been published since. */
interface Inventory {
  scannedAt: number;
  bytes: number;
}

function parseInventory(value: unknown, now: number): Inventory | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { version, scannedAt, bytes } = value;
  if (
    version !== INVENTORY_VERSION ||
    typeof scannedAt !== 'number' ||
    !Number.isSafeInteger(scannedAt) ||
    scannedAt < 0 ||
    scannedAt > now ||
    typeof bytes !== 'number' ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0
  ) {
    return undefined;
  }

  return { scannedAt, bytes };
}

export interface DiskBudgetOptions {
  trace?: CacheTrace | undefined;
  /** Entries whose directory has been untouched for longer than this are removed by a sweep. */
  maxAgeMs?: number;
}

/** Reports the bytes published in the reservation; omit it when nothing was published. */
export type ReleaseReservation = (published?: number) => Promise<void>;

/**
 * Admission control for an archive directory shared by any number of connector
 * processes. Each instance serializes its own admissions and counts its in-flight
 * reservations exactly. Stored bytes are inventoried by a sweep at most once per
 * interval, and recorded with every publication in a sidecar file that the processes
 * share. A sweep also runs before a reservation whose estimate might exceed the budget
 * or that finds too little free disk. Between sweeps the estimate omits what concurrent
 * processes publish, which is corrected by the next sweep.
 */
export class DiskBudget {
  private reserved = 0;
  private published = 0;
  private unrecorded = false;
  private admission: Promise<void> = Promise.resolve();
  private ledger: Promise<void> = Promise.resolve();
  private readonly trace: CacheTrace | undefined;
  private readonly maxAgeMs: number | undefined;
  private readonly inventory: string;

  constructor(
    readonly directory: string,
    readonly bytes: number,
    options: DiskBudgetOptions = {},
  ) {
    if (!Number.isSafeInteger(bytes) || bytes < 1) {
      throw new Error('Invalid disk budget');
    }

    const { trace, maxAgeMs } = options;
    if (maxAgeMs !== undefined && (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1)) {
      throw new Error('Invalid disk budget');
    }

    this.trace = trace;
    this.maxAgeMs = maxAgeMs;
    this.inventory = join(directory, INVENTORY_FILE);
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

        // A read touches the directory and publication creates its files after
        // createdAt, so the directory is never older than createdAt: this removes
        // only a subset of what LocalStore.get already treats as expired.
        if (this.maxAgeMs !== undefined && Date.now() - info.mtimeMs > this.maxAgeMs) {
          await rm(entry, { recursive: true, force: true });

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

  /** A missing, unreadable, malformed, wrong-version or future-dated file reads as absent. */
  private async readInventory(): Promise<Inventory | undefined> {
    try {
      const handle = await open(this.inventory, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > MAX_INVENTORY_FILE_BYTES) {
          return undefined;
        }

        return parseInventory(JSON.parse(await handle.readFile('utf8')), Date.now());
      } finally {
        await handle.close();
      }
    } catch {
      return undefined;
    }
  }

  /** Replaces the file atomically; a failure only costs the next reservation a sweep. */
  private async writeInventory(inventory: Inventory): Promise<boolean> {
    const partial = join(this.directory, `.tmp-inventory-${randomUUID()}`);
    try {
      await writeFile(partial, JSON.stringify({ version: INVENTORY_VERSION, ...inventory }), {
        flag: FileOpenMode.ExclusiveWrite,
        mode: FilePermissions.OwnerOnlyFile,
      });
      await rename(partial, this.inventory);

      return true;
    } catch {
      await rm(partial, { force: true }).catch(() => undefined);

      return false;
    }
  }

  /** Serializes this instance's inventory updates; other processes are not excluded. */
  private exclusive(work: () => Promise<void>): Promise<void> {
    const run = this.ledger.then(work);
    this.ledger = run.catch(() => undefined);

    return run;
  }

  private async record(published: number): Promise<void> {
    this.published += published;

    await this.exclusive(async () => {
      const current = await this.readInventory();
      if (!current) {
        return;
      }

      const bytes = current.bytes + published;
      if (!(await this.writeInventory({ scannedAt: current.scannedAt, bytes }))) {
        this.unrecorded = true;
      }
    });
  }

  private async sweepDue(bytes: number): Promise<boolean> {
    if (this.unrecorded) {
      return true;
    }

    const current = await this.readInventory();
    if (!current || Date.now() - current.scannedAt > SWEEP_INTERVAL_MS) {
      return true;
    }

    return current.bytes + this.reserved + bytes > this.bytes;
  }

  /** Inventories the archive, removes expired and surplus entries, and records the exact total. */
  private async sweep(bytes: number): Promise<number> {
    const publishedBefore = this.published;
    const scanFinished = this.trace?.begin('disk.scan');
    let entries: Awaited<ReturnType<DiskBudget['entries']>>;
    try {
      entries = await this.entries();
    } finally {
      scanFinished?.();
    }

    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries) {
      if (total + this.reserved + bytes <= this.bytes) {
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

    // Publications finished during the scan may be missing from its total.
    const scannedAt = Date.now();
    const recorded = total + this.published - publishedBefore;
    await this.exclusive(async () => {
      this.unrecorded = !(await this.writeInventory({ scannedAt, bytes: recorded }));
    });

    if (total + this.reserved + bytes > this.bytes) {
      throw new Error('Cache disk budget exhausted');
    }

    return entries.length;
  }

  private async availableBytes(bytes: number, entries: number | undefined): Promise<number> {
    const statfsFinished = this.trace?.begin('disk.statfs');
    const disk = await statfs(this.directory).finally(() => {
      const reservedBytes = this.reserved + bytes;
      statfsFinished?.(entries === undefined ? { reservedBytes } : { entries, reservedBytes });
    });

    return disk.bavail * disk.bsize;
  }

  async reserve(bytes: number): Promise<ReleaseReservation> {
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

      let scanned: number | undefined;
      if (await this.sweepDue(bytes)) {
        scanned = await this.sweep(bytes);
      }

      let available = await this.availableBytes(bytes, scanned);
      if (available < this.reserved + bytes && scanned === undefined) {
        // Free space is the hard floor and the estimate may have drifted: eviction
        // and expiry could still make room.
        scanned = await this.sweep(bytes);
        available = await this.availableBytes(bytes, scanned);
      }

      if (available < this.reserved + bytes) {
        throw new Error('Insufficient cache disk space');
      }

      this.reserved += bytes;
      let released = false;
      return async (published) => {
        if (released) {
          return;
        }

        released = true;
        try {
          if (published !== undefined && Number.isSafeInteger(published) && published > 0) {
            await this.record(published);
          }
        } finally {
          this.reserved -= bytes;
        }
      };
    } finally {
      unlock();
    }
  }
}
