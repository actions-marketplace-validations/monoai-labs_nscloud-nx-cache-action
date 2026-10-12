import { appendFile } from 'node:fs/promises';
import type { CacheMetricsSnapshot, CacheOperationTotal } from './metrics.js';

type AppendSummary = (path: string, content: string) => Promise<void>;

function row(label: string, total: CacheOperationTotal): string {
  return `| ${label} | ${total.count} | ${total.bytes} | ${Math.round(total.durationMs)} ms |`;
}

export function renderCacheSummary(snapshot: CacheMetricsSnapshot): string {
  return [
    '### Nx cache operations',
    '',
    'Counts describe connector operations. Duration is connector I/O time, not Nx task count or wall time.',
    '',
    '| Operation | Count | Bytes | Duration |',
    '| --- | ---: | ---: | ---: |',
    row('Local hits', snapshot.localHits),
    row('Artifact hits', snapshot.artifactHits),
    row('Misses', snapshot.misses),
    row('Local writes', snapshot.localWrites),
    row('Artifact publications', snapshot.publications),
    row('Read-only skips', snapshot.readOnlySkips),
    row('Remote policy skips', snapshot.policySkips),
    row('Already present', snapshot.alreadyPresent),
    row('Remote unavailable', snapshot.unavailable),
    row('Corrupt local entries', snapshot.corrupt),
    row('Request overload', snapshot.overload),
    row('Errors', snapshot.errors),
    '',
  ].join('\n');
}

export async function appendCacheSummary(
  path: string | undefined,
  snapshot: CacheMetricsSnapshot,
  write: AppendSummary = appendFile,
  reportError: () => void = () => process.stderr.write('Cache summary could not be written\n'),
): Promise<boolean> {
  if (!path) {
    return false;
  }

  try {
    await write(path, `${renderCacheSummary(snapshot)}\n`);
    return true;
  } catch {
    reportError();
    return false;
  }
}
