/**
 * Define anonymous archive shapes, corpus inputs and generated fixture manifests.
 * Shared types let profiling and generation agree on calibration fields while
 * retaining support for custom surveys that do not contain exact archive layouts.
 *
 * Imported by profile.ts and fixture.ts; this module is not a command.
 */

import type { CacheEvent } from '../../src/metrics.js';
import type { TarEntryType } from './tar-format.js';

export interface ArchiveLayoutEntry {
  id: number;
  parent: number | null;
  depth: number;
  type:
    | typeof TarEntryType.File
    | typeof TarEntryType.HardLink
    | typeof TarEntryType.SymbolicLink
    | typeof TarEntryType.Directory
    | typeof TarEntryType.ContiguousFile;
  mode: string;
  size: number;
  extension: string;
}

export interface RestorationProfile {
  id: string;
  compressedBytes: number;
  attempts: number;
  expandedTarBytes: number;
  outputBytes: number;
  metadataBytes: number;
  fileCount: number;
  directoryCount: number;
  maxDepth: number;
  fileBytes: Record<string, number | null>;
  fileSizeBytes: number[];
  depthCounts: Record<string, number>;
  modeCounts: Record<string, number>;
  directoryChildCounts: number[];
  types: Record<string, number>;
  extensions: Record<string, { count: number; bytes: number }>;
  compressionRatio: number;
  filesPerMiB: number | null;
  layout?: ArchiveLayoutEntry[];
}

export type FixtureProfile = Pick<
  RestorationProfile,
  | 'id'
  | 'compressedBytes'
  | 'attempts'
  | 'expandedTarBytes'
  | 'outputBytes'
  | 'metadataBytes'
  | 'fileCount'
  | 'directoryCount'
  | 'maxDepth'
  | 'fileSizeBytes'
  | 'depthCounts'
  | 'modeCounts'
  | 'directoryChildCounts'
  | 'types'
  | 'layout'
> & {
  extensions: Record<string, number | { count: number; bytes: number }>;
};

export interface RestorationCorpus {
  representativeIds: string[];
  profiles: FixtureProfile[];
}

export interface GeneratedFixture {
  profileId: string;
  hash: string;
  digest: string;
  file: string;
  bytes: number;
  attempts: number;
  calibration: RestorationProfile;
  exactLayout: boolean;
  manifest: { path: string; size: number; mode: number; digest: string }[];
  directories: { path: string; mode: number }[];
  terminalDigest: string;
  code: number;
}

export interface GeneratedCorpus {
  schemaVersion: 1;
  corpusDigest: string;
  nx: string;
  synthetic: true;
  fixtures: GeneratedFixture[];
}

export type SanitizedCacheEvent = Omit<CacheEvent, 'hash'> & { hash?: string };
