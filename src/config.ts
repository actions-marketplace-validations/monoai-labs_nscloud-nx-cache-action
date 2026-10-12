import { resolve } from 'node:path';
import { GIBIBYTE, MEBIBYTE, KIBIBYTE, HOUR_MS, HOURS_PER_DAY } from './units.js';

export const CacheAccess = Object.freeze({ ReadOnly: 'read-only', ReadWrite: 'read-write' });
export const CacheFailureMode = Object.freeze({ FailOpen: 'fail-open', Strict: 'strict' });

export const DEFAULT_ARTIFACT_REGION = 'ord';
export const DEFAULT_MAX_DISK_BYTES = 10 * GIBIBYTE;
export const DEFAULT_EXTRACTION_BYTES = 2 * GIBIBYTE;
export const DEFAULT_MAX_ARCHIVE_BYTES = 512 * MEBIBYTE;
export const MAX_ARCHIVE_METADATA_BYTES = 4 * KIBIBYTE;
export const DEFAULT_RETENTION_HOURS = 7 * HOURS_PER_DAY;
export const DEFAULT_RETENTION_MS = DEFAULT_RETENTION_HOURS * HOUR_MS;
export const DEFAULT_LOCAL_DISK_BYTES = DEFAULT_MAX_DISK_BYTES - DEFAULT_EXTRACTION_BYTES;

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Invalid ${name}`);
  }

  return value;
}

export function configuration(env: NodeJS.ProcessEnv) {
  const directory = env.NX_ARCHIVE_DIRECTORY;
  if (!directory) {
    throw new Error('NX_ARCHIVE_DIRECTORY is required');
  }

  const failureMode = env.NX_CACHE_FAILURE_MODE ?? CacheFailureMode.FailOpen;
  if (failureMode !== CacheFailureMode.Strict && failureMode !== CacheFailureMode.FailOpen) {
    throw new Error('Invalid cache failure mode');
  }

  const access = env.NX_CACHE_ACCESS ?? CacheAccess.ReadWrite;
  if (access !== CacheAccess.ReadOnly && access !== CacheAccess.ReadWrite) {
    throw new Error('Invalid cache access mode');
  }

  const remoteAccess = env.NX_CACHE_REMOTE_ACCESS ?? CacheAccess.ReadWrite;
  if (remoteAccess !== CacheAccess.ReadOnly && remoteAccess !== CacheAccess.ReadWrite) {
    throw new Error('Invalid remote cache access mode');
  }

  const maxDiskBytes = integer(env, 'NX_CACHE_DISK_BYTES', DEFAULT_MAX_DISK_BYTES);
  const extractionBytes = integer(env, 'NX_CACHE_EXTRACTION_BYTES', DEFAULT_EXTRACTION_BYTES);
  const maxArchiveBytes = integer(env, 'NX_CACHE_ARCHIVE_BYTES', DEFAULT_MAX_ARCHIVE_BYTES);
  if (maxDiskBytes - extractionBytes < maxArchiveBytes + MAX_ARCHIVE_METADATA_BYTES) {
    throw new Error('Cache disk budget is too small');
  }

  return {
    directory: resolve(directory),
    strict: failureMode === CacheFailureMode.Strict,
    readOnly: access === CacheAccess.ReadOnly,
    remoteReadOnly: remoteAccess === CacheAccess.ReadOnly,
    maxDiskBytes: maxDiskBytes - extractionBytes,
    extractionBytes,
    maxArchiveBytes,
    maxAgeMs: integer(env, 'NX_CACHE_RETENTION_HOURS', DEFAULT_RETENTION_HOURS) * HOUR_MS,
  };
}
