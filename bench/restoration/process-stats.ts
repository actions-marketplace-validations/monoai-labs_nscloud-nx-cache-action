/**
 * Collect Linux adapter-process CPU, memory and filesystem I/O evidence.
 * The controller samples the adapter separately from the requesting client so
 * restoration diagnostics describe the process doing archive work. Missing /proc
 * data or another platform produces unavailable evidence rather than invented metrics.
 *
 * Imported by run.ts; this module is not a command.
 */

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { KIBIBYTE, SECOND_MS } from '../../src/units.js';

const PROC_STAT_USER_TICKS_INDEX = 11;
const PROC_STAT_SYSTEM_TICKS_INDEX = 12;

const ticks =
  process.platform === 'linux'
    ? Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim())
    : null;

export async function snapshotProcess(pid: number) {
  if (process.platform !== 'linux' || ticks === null) {
    return null;
  }

  try {
    const [stat, io, status] = await Promise.all([
      readFile(`/proc/${pid}/stat`, 'utf8'),
      readFile(`/proc/${pid}/io`, 'utf8'),
      readFile(`/proc/${pid}/status`, 'utf8'),
    ]);
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    const values = Object.fromEntries(
      io
        .trim()
        .split('\n')
        .map((line) => line.split(':').map((value) => value.trim())),
    );

    const memory = (key: string) =>
      Number(new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(status)?.[1] ?? 0) * KIBIBYTE;

    return {
      userMs: (Number(fields[PROC_STAT_USER_TICKS_INDEX]) * SECOND_MS) / ticks,
      systemMs: (Number(fields[PROC_STAT_SYSTEM_TICKS_INDEX]) * SECOND_MS) / ticks,
      rssBytes: memory('VmRSS'),
      lifetimePeakRssBytes: memory('VmHWM'),
      readBytes: Number(values.read_bytes),
      writeBytes: Number(values.write_bytes),
      cpuResolutionMs: SECOND_MS / ticks,
    };
  } catch {
    return null;
  }
}

export function processDelta(
  before: Awaited<ReturnType<typeof snapshotProcess>>,
  after: Awaited<ReturnType<typeof snapshotProcess>>,
) {
  if (!before || !after) {
    return { available: false };
  }

  return {
    available: true,
    cpuUserMs: Math.max(0, after.userMs - before.userMs),
    cpuSystemMs: Math.max(0, after.systemMs - before.systemMs),
    rssBytes: after.rssBytes,
    lifetimePeakRssBytes: after.lifetimePeakRssBytes,
    cpuResolutionMs: after.cpuResolutionMs,
    readBytes: Math.max(0, after.readBytes - before.readBytes),
    writeBytes: Math.max(0, after.writeBytes - before.writeBytes),
    scope:
      'Adapter process batch interval; tick-resolution CPU and filesystem IO counters, not per-stage CPU or per-request peak RSS',
  };
}
