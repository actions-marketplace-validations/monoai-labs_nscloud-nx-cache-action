/**
 * Name the frozen restoration lanes, sampling limits and seed lifetime.
 * Sharing these values keeps controller preparation and analysis qualification
 * consistent. Imported by the harness; this module is not a command.
 */

export const MEDIAN_QUANTILE = 0.5;
export const P95_QUANTILE = 0.95;

export const BenchmarkArm = Object.freeze({ Baseline: 'baseline', Candidate: 'candidate' });
export const RestorationLane = Object.freeze({
  AdapterLocal: 'adapter-local',
  AdapterRemote: 'adapter-remote',
  NxLocal: 'nx-local',
  NxRemote: 'nx-remote',
  MixedInvocation: 'mixed-invocation',
});
export const SampleExclusion = Object.freeze({ FirstAccess: 'first-access', Warmup: 'warmup' });
export const AnalysisMode = Object.freeze({
  Performance: 'performance',
  TracingOverhead: 'tracing-overhead',
});

export const MIN_PAIRS_PER_JOB = 20;
export const MIN_JOB_BLOCKS = 3;
export const MIN_TOTAL_PAIRS = MIN_PAIRS_PER_JOB * MIN_JOB_BLOCKS;
export const DEFAULT_MEASURED_PAIRS = MIN_PAIRS_PER_JOB;
export const MAX_MEASURED_PAIRS = 120;
export const EXCLUDED_PAIRS_PER_LANE = 2;
export const PARALLEL_RESTORATION_REQUESTS = 3;
export const FIXTURE_REPLICAS = 3;
export const MAX_INVENTORY_POPULATION = 16_384;
export const SEED_EXPIRATION_HOURS = 3;
