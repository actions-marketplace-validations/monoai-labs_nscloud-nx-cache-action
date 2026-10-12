/**
 * Measure archive structure and summarize sanitized cache events.
 * Anonymous shape statistics provide calibration inputs for synthetic archives;
 * event summaries describe restoration activity without retaining private contents
 * or paths from the original archive.
 *
 * Run: pnpm exec tsx bench/restoration/profile.ts archive|events <file>.
 * Writes JSON to stdout; keep original archives and raw logs outside the repository.
 */

import type {
  RestorationProfile,
  ArchiveLayoutEntry,
  SanitizedCacheEvent,
} from './profile-types.js';
import type { CacheEvent } from '../../src/metrics.js';
import { gunzipSync } from 'node:zlib';
import { posix, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MEBIBYTE } from '../../src/units.js';
import {
  Ascii,
  TarNumberEncoding,
  BYTE_VALUE_RANGE,
  OCTAL_RADIX,
  TAR_BLOCK_BYTES,
  TAR_TERMINATOR_BYTES,
  TarHeader,
  SIGNED_BYTE_MAX,
  TarEntryType,
} from './tar-format.js';
import { CacheOperation, CacheTier } from '../../src/metrics.js';
import { NODE_USER_ARGUMENT_OFFSET } from '../../src/process-constants.js';

const TAR_EXTENSION_TYPES: readonly string[] = [
  TarEntryType.PaxHeader,
  TarEntryType.GlobalPaxHeader,
  TarEntryType.GnuLongName,
  TarEntryType.GnuLongLink,
];

const DEFAULT_EXPANSION_LIMIT_BYTES = 512 * MEBIBYTE;
const DEFAULT_TAR_ENTRY_LIMIT = 100_000;
const ProfileMode = Object.freeze({ Archive: 'archive', Events: 'events' });

const ansiColorPattern = new RegExp(`${String.fromCharCode(Ascii.Escape)}\\[[0-9;]*m`, 'g');

function integer(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}`);
  }

  return value;
}

function tarNumber(bytes: Buffer) {
  const first = bytes.readUInt8(0);
  if (first & TarNumberEncoding.BinaryFlag) {
    if (first & TarNumberEncoding.NegativeFlag) {
      throw new Error('Negative tar number');
    }

    let value = BigInt(first & TarNumberEncoding.ValueMask);
    for (const byte of bytes.subarray(1)) {
      value = value * BigInt(BYTE_VALUE_RANGE) + BigInt(byte);
    }

    return integer(Number(value), 'tar number');
  }

  const text = bytes.toString('ascii').replace(/\0.*$/s, '').trim();
  if (!/^[0-7]*$/.test(text)) {
    throw new Error('Invalid octal tar number');
  }

  return integer(text ? Number.parseInt(text, OCTAL_RADIX) : 0, 'tar number');
}

function tarText(bytes: Buffer) {
  return bytes.toString('utf8').replace(/\0.*$/s, '');
}

function safeName(name: string) {
  if (
    !name ||
    name.includes('\0') ||
    name.includes('\\') ||
    posix.isAbsolute(name) ||
    name.split('/').includes('..')
  ) {
    throw new Error('Unsafe tar path');
  }

  return posix.normalize(name).replace(/^\.\//, '').replace(/\/$/, '');
}

function paxFields(bytes: Buffer) {
  const fields: Record<string, string> = {};
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(Ascii.Space, offset);
    const token = bytes.subarray(offset, space).toString('ascii');
    if (space < offset || !/^[1-9][0-9]*$/.test(token)) {
      throw new Error('Invalid PAX length');
    }

    const length = integer(Number(token), 'PAX length');
    const end = offset + length;
    if (end > bytes.length || end <= space + 1 || bytes[end - 1] !== Ascii.LineFeed) {
      throw new Error('Truncated PAX record');
    }

    const record = bytes.subarray(space + 1, end - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals < 1) {
      throw new Error('Invalid PAX field');
    }

    const key = record.slice(0, equals);
    if (key.startsWith('GNU.sparse.')) {
      throw new Error('Sparse archives are unsupported');
    }

    fields[key] = record.slice(equals + 1);
    offset = end;
  }

  return fields;
}

function count(histogram: Record<string, number>, key: string | number) {
  histogram[key] = (histogram[key] ?? 0) + 1;
}

function extension(name: string) {
  const basename = posix.basename(name);
  for (const suffix of [
    'd.ts.map',
    'd.mts.map',
    'd.cts.map',
    'd.ts',
    'd.mts',
    'd.cts',
    'js.map',
    'mjs.map',
    'cjs.map',
    'css.map',
  ]) {
    if (basename.endsWith(`.${suffix}`)) {
      return suffix;
    }
  }

  const suffix = posix.extname(basename).slice(1);
  if (!suffix) {
    return '(none)';
  }

  return new Set([
    'js',
    'mjs',
    'cjs',
    'ts',
    'tsx',
    'jsx',
    'json',
    'html',
    'css',
    'map',
    'txt',
    'log',
    'xml',
    'svg',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'woff',
    'woff2',
    'wasm',
  ]).has(suffix)
    ? suffix
    : '(other)';
}

export function nearestRank(values: number[], fraction: number): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

// Read-only inspection. Original paths and payload bytes never leave this function.

export function profileArchive(
  compressed: Buffer,
  {
    id = 'anonymous',
    attempts = 1,
    maxExpandedBytes = DEFAULT_EXPANSION_LIMIT_BYTES,
    maxEntries = DEFAULT_TAR_ENTRY_LIMIT,
    includeLayout = false,
  }: {
    id?: string;
    attempts?: number;
    maxExpandedBytes?: number;
    maxEntries?: number;
    includeLayout?: boolean;
  } = {},
): RestorationProfile {
  integer(attempts, 'attempts');
  integer(maxExpandedBytes, 'expansion limit');
  integer(maxEntries, 'entry limit');
  if (!maxExpandedBytes || !maxEntries) {
    throw new Error('Archive limits must be positive');
  }

  const tar = gunzipSync(compressed, { maxOutputLength: maxExpandedBytes });
  if (tar.length % TAR_BLOCK_BYTES !== 0) {
    throw new Error('Truncated tar block');
  }

  const result: RestorationProfile = {
    id,
    compressedBytes: compressed.length,
    attempts,
    expandedTarBytes: tar.length,
    outputBytes: 0,
    metadataBytes: 0,
    fileCount: 0,
    directoryCount: 0,
    maxDepth: 0,
    fileBytes: {},
    fileSizeBytes: [],
    depthCounts: {},
    modeCounts: {},
    directoryChildCounts: [],
    types: {},
    extensions: {},
    compressionRatio: tar.length / compressed.length,
    filesPerMiB: null,
  };

  const children: Map<string, number> = new Map();
  const paths: Map<string, number> = new Map();
  const layout: (Omit<ArchiveLayoutEntry, 'parent'> & { parentPath: string })[] = [];
  let offset = 0;
  let headers = 0;
  let ended = false;
  let globalPax: Record<string, string> = {};
  let localPax: Record<string, string> = {};
  let longName: string | undefined;

  while (offset < tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (header.every((byte) => byte === 0)) {
      if (
        tar.length - offset < TAR_TERMINATOR_BYTES ||
        !tar.subarray(offset).every((byte) => byte === 0)
      ) {
        throw new Error('Invalid tar terminator');
      }

      ended = true;
      break;
    }
    if (++headers > maxEntries) {
      throw new Error('Archive entry limit exceeded');
    }

    const checksum = tarNumber(header.subarray(TarHeader.ChecksumStart, TarHeader.ChecksumEnd));
    let sum = 0;
    let signedSum = 0;
    for (let index = 0; index < TAR_BLOCK_BYTES; index++) {
      const byte =
        index >= TarHeader.ChecksumStart && index < TarHeader.ChecksumEnd
          ? Ascii.Space
          : header.readUInt8(index);
      sum += byte;
      signedSum += byte > SIGNED_BYTE_MAX ? byte - BYTE_VALUE_RANGE : byte;
    }

    if (checksum !== sum && checksum !== signedSum) {
      throw new Error('Tar checksum mismatch');
    }

    const type = String.fromCharCode(header[TarHeader.TypeOffset] || Ascii.Zero);
    let size = tarNumber(header.subarray(TarHeader.SizeStart, TarHeader.SizeEnd));
    const fields = { ...globalPax, ...localPax };
    if (!TAR_EXTENSION_TYPES.includes(type) && fields.size !== undefined) {
      if (!/^[0-9]+$/.test(fields.size)) {
        throw new Error('Invalid PAX size');
      }

      size = integer(Number(fields.size), 'PAX size');
    }

    const bodyStart = offset + TAR_BLOCK_BYTES;
    const bodyEnd = bodyStart + size;
    offset = bodyStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (bodyEnd > tar.length || offset > tar.length) {
      throw new Error('Truncated tar entry');
    }

    const body = tar.subarray(bodyStart, bodyEnd);
    if (type === TarEntryType.PaxHeader) {
      localPax = paxFields(body);
      continue;
    }
    if (type === TarEntryType.GlobalPaxHeader) {
      globalPax = { ...globalPax, ...paxFields(body) };
      continue;
    }
    if (type === TarEntryType.GnuLongName) {
      longName = tarText(body);
      continue;
    }
    if (type === TarEntryType.GnuLongLink) {
      continue;
    } // link target text is intentionally not retained
    if (
      type !== TarEntryType.File &&
      type !== TarEntryType.HardLink &&
      type !== TarEntryType.SymbolicLink &&
      type !== TarEntryType.Directory &&
      type !== TarEntryType.ContiguousFile
    ) {
      throw new Error(`Unsupported tar entry type ${type}`);
    }

    const prefix =
      header.subarray(TarHeader.MagicStart, TarHeader.MagicEnd).toString('ascii') === 'ustar\0'
        ? tarText(header.subarray(TarHeader.PrefixStart, TarHeader.PrefixEnd))
        : '';
    const name = safeName(
      fields.path ??
        longName ??
        `${prefix ? `${prefix}/` : ''}${tarText(header.subarray(TarHeader.NameStart, TarHeader.NameEnd))}`,
    );
    localPax = {};
    longName = undefined;
    count(result.types, type);

    const metadata = name === 'code' || name === 'terminalOutput';
    if (metadata) {
      result.metadataBytes += size;
      continue;
    }
    if (name === '.' || name === 'outputs') {
      continue;
    }
    if (paths.has(name)) {
      throw new Error('Duplicate tar output path');
    }

    const parts = name.split('/');
    const depth = parts.length;
    const mode = tarNumber(header.subarray(TarHeader.ModeStart, TarHeader.ModeEnd)).toString(
      OCTAL_RADIX,
    );
    const parent = posix.dirname(name);
    const entryId = paths.size;
    paths.set(name, entryId);

    count(result.depthCounts, depth);
    count(result.modeCounts, mode);
    result.maxDepth = Math.max(result.maxDepth, depth);
    children.set(parent, (children.get(parent) ?? 0) + 1);

    if (type === TarEntryType.Directory) {
      result.directoryCount++;
      if (!children.has(name)) {
        children.set(name, 0);
      }
    }

    if (type === TarEntryType.File || type === TarEntryType.ContiguousFile) {
      result.fileCount++;
      result.outputBytes += size;
      result.fileSizeBytes.push(size);

      const suffix = extension(name);
      const summary = (result.extensions[suffix] ??= { count: 0, bytes: 0 });
      summary.count++;
      summary.bytes += size;
    }

    layout.push({
      id: entryId,
      parentPath: parent,
      depth,
      type,
      mode,
      size,
      extension: extension(name),
    });
  }

  if (!ended || Object.keys(localPax).length || longName !== undefined) {
    throw new Error('Incomplete tar archive');
  }

  result.fileSizeBytes.sort((a, b) => a - b);
  for (const fraction of [0, 0.1, 0.5, 0.9, 0.95, 0.99, 1]) {
    result.fileBytes[fraction] = nearestRank(result.fileSizeBytes, fraction);
  }

  result.directoryChildCounts = [...children.values()].sort((a, b) => a - b);
  result.filesPerMiB = result.outputBytes
    ? (result.fileCount * MEBIBYTE) / result.outputBytes
    : null;
  if (includeLayout) {
    result.layout = layout.map(({ parentPath, ...entry }) => ({
      ...entry,
      parent: paths.get(parentPath) ?? null,
    }));
  }

  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperation(value: unknown): value is CacheEvent['operation'] {
  return value === 'get' || value === 'put' || value === 'publish' || value === 'remote';
}

function isTier(value: unknown): value is CacheEvent['tier'] {
  return (
    value === 'local' ||
    value === 'artifact' ||
    value === 'miss' ||
    value === 'error' ||
    value === 'readonly' ||
    value === 'policy' ||
    value === 'already-present' ||
    value === 'unavailable' ||
    value === 'corrupt' ||
    value === 'overload'
  );
}

export function parseCacheEvents(
  log: string,
  { includeHashes = false }: { includeHashes?: boolean } = {},
): SanitizedCacheEvent[] {
  const events: SanitizedCacheEvent[] = [];
  for (const line of log.split('\n')) {
    const marker = line.indexOf('{"cache":');
    if (marker < 0) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line.slice(marker).replace(ansiColorPattern, '').trim());
    } catch {
      throw new Error('Malformed cache event JSON');
    }

    const event = isObject(parsed) ? parsed.cache : undefined;
    if (
      !isObject(event) ||
      !isOperation(event.operation) ||
      !isTier(event.tier) ||
      typeof event.durationMs !== 'number' ||
      !Number.isFinite(event.durationMs) ||
      event.durationMs < 0
    ) {
      throw new Error('Invalid cache event');
    }

    const record: SanitizedCacheEvent = {
      operation: event.operation,
      tier: event.tier,
      durationMs: event.durationMs,
    };
    if (event.bytes !== undefined) {
      record.bytes = integer(event.bytes, 'cache event bytes');
    }
    if (
      typeof event.errorCode === 'string' &&
      /^(integrity|timeout|cache-operation|unknown|rpc-(?:[0-9]|1[0-6])|ENOENT|ENOSPC|EACCES|EPERM|ETIMEDOUT|ECONNRESET)$/.test(
        event.errorCode,
      )
    ) {
      record.errorCode = event.errorCode;
    }
    if (
      includeHashes &&
      typeof event.hash === 'string' &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(event.hash)
    ) {
      record.hash = event.hash;
    }

    events.push(record);
  }

  return events;
}

export function summarizeCacheEvents(events: SanitizedCacheEvent[]) {
  const byPath: Record<string, number> = {};
  let successfulGets = 0;
  let restoredBytes = 0;
  for (const event of events) {
    count(byPath, `${event.operation}:${event.tier}`);
    if (
      event.operation === CacheOperation.Get &&
      (event.tier === CacheTier.Local || event.tier === CacheTier.Artifact)
    ) {
      successfulGets++;
      restoredBytes += event.bytes ?? 0;
    }
  }

  return { eventCount: events.length, successfulGets, restoredBytes, byPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, file] = process.argv.slice(NODE_USER_ARGUMENT_OFFSET);
  if (!file || (mode !== ProfileMode.Archive && mode !== ProfileMode.Events)) {
    throw new Error('Usage: profile.ts archive|events <file>');
  }

  console.log(
    JSON.stringify(
      mode === ProfileMode.Archive
        ? profileArchive(readFileSync(file))
        : summarizeCacheEvents(parseCacheEvents(readFileSync(file, 'utf8'))),
      null,
      2,
    ),
  );
}
