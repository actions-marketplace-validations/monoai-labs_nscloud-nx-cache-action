/**
 * Select the GitHub repository holding immutable benchmark references.
 * BENCH_REFERENCE_REPOSITORY supports comparisons against public forks while
 * the caller selects an immutable commit and the downloader records its digest.
 *
 * Imported by the baseline downloader; this module is not a command.
 */

export function referenceRepository(env = process.env) {
  const repository = env.BENCH_REFERENCE_REPOSITORY ?? 'monoai-labs/nscloud-nx-cache-action';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Expected BENCH_REFERENCE_REPOSITORY as owner/repository');
  }

  return repository;
}
