import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { analyzeResults, validateResult } from '../bench/restoration/analyze.js';
import type {
  GroupSummary,
  MeasuredGroup,
  ResultDocument as Result,
  Sample,
} from '../bench/restoration/analysis-types.js';
import { CacheTier } from '../src/metrics.js';

const analyzerUrl = new URL('../bench/restoration/analyze.ts', import.meta.url);
const execFileAsync = promisify(execFile);
const digest = 'a'.repeat(64);

function fixture(
  delta: (job: number, pair: number, baseline: number) => number = () => 0,
  counts = [20, 20, 20],
): Result[] {
  return counts.map((count, job) => {
    const jobId = `job-${job}`;
    const samples: Sample[] = [];
    for (let pair = 0; pair < count; pair += 1) {
      const baseline = 100 + pair * 0.1 + job;
      for (const arm of ['baseline', 'candidate'] satisfies Sample['arm'][]) {
        samples.push({
          jobId,
          pair,
          arm,
          profileId: 'package-medium',
          concurrency: 1,
          lane: 'adapter-remote',
          population: 0,
          durationMs: baseline + (arm === 'candidate' ? delta(job, pair, baseline) : 0),
          bytes: 27341,
          valid: true,
          proof: { tier: CacheTier.Artifact, digest, noPublication: true, completeBody: true },
        });
      }
    }

    return {
      schemaVersion: 1,
      jobId,
      protocol: 'restoration-v1',
      runtime: {
        node: '24.18.1',
        nx: '23.2.1',
        platform: 'linux',
        arch: 'x64',
        runnerProfile: 'benchmark',
        region: 'ord',
      },
      baseline: { revision: 'a'.repeat(40), digest },
      candidate: { revision: 'b'.repeat(40), digest: 'b'.repeat(64) },
      corpusDigest: digest,
      samples,
      failures: [],
    };
  });
}

function sampleAt(documents: Result[], job = 0, index = 0): Sample {
  const sample = documents[job]?.samples[index];
  if (!sample) {
    throw new Error('Missing test fixture sample');
  }

  return sample;
}

function measuredGroup(group: GroupSummary | undefined): MeasuredGroup {
  assert.ok(group && group.status !== 'incomplete');

  return group;
}

test('identical and faster candidates pass with reproducible block intervals', () => {
  const documents = fixture();
  assert.deepEqual(validateResult(documents[0]), []);

  const result = analyzeResults(documents);
  const group = measuredGroup(result.groups[0]);
  assert.equal(result.status, 'passed');
  assert.equal(group.evidence.pairs, 60);
  assert.deepEqual(group.median.absoluteMs95, { low: 0, high: 0 });
  assert.deepEqual(result, analyzeResults(documents));
  assert.equal(analyzeResults(fixture(() => -40)).status, 'passed');
});

test('a regression must exceed both the absolute and relative margin', () => {
  assert.equal(analyzeResults(fixture(() => 40)).status, 'failed');

  const smallAbsolute = fixture((_job, _pair, baseline) => baseline * 0.2);
  for (const document of smallAbsolute) {
    for (const sample of document.samples) {
      sample.durationMs /= 10;
    }
  }

  assert.equal(analyzeResults(smallAbsolute).status, 'passed');

  const smallRelative = fixture(() => 35);
  for (const document of smallRelative) {
    for (const sample of document.samples) {
      sample.durationMs += 400;
    }
  }

  assert.equal(analyzeResults(smallRelative).status, 'passed');
});

test('p95 independently rejects a slow tail while median remains within margin', () => {
  const result = analyzeResults(fixture((_job, pair) => (pair >= 16 ? 50 : 0)));
  const group = measuredGroup(result.groups[0]);

  assert.equal(result.status, 'failed');
  assert.equal(group.median.decision, 'within-margin');
  assert.equal(group.p95.decision, 'regression');
});

test('a job-dependent effect that crosses a margin remains inconclusive', () => {
  const result = analyzeResults(fixture((job) => 5 + job * 10));
  const group = measuredGroup(result.groups[0]);

  assert.equal(result.status, 'inconclusive');
  assert.equal(group.median.decision, 'inconclusive');
  assert.ok(group.median.absoluteMs95.low < 10);
  assert.ok(group.median.absoluteMs95.high > 10);
});

test('sample counts, independent jobs and per-job minima each gate completion', () => {
  for (const counts of [
    [19, 20, 20],
    [30, 30],
    [10, 25, 25],
  ]) {
    assert.equal(analyzeResults(fixture(() => 0, counts)).status, 'incomplete');
  }

  assert.equal(analyzeResults([]).status, 'incomplete');
});

test('groups do not hide an individual regression or pool different concurrency and inventories', () => {
  const documents = fixture();
  for (const [job, document] of documents.entries()) {
    const second = fixture(() => 40)[job];
    if (!second) {
      throw new Error('Missing secondary fixture');
    }

    document.samples.push(
      ...second.samples.map((sample) => ({
        ...sample,
        profileId: 'html-large',
        concurrency: 3,
        population: 1000,
      })),
    );
  }

  const result = analyzeResults(documents);
  assert.equal(result.status, 'failed');
  assert.equal(result.groups.length, 2);
  assert.ok(
    result.groups.some(
      (group) => group.profileId === 'package-medium' && group.status === 'passed',
    ),
  );
});

test('wrong-tier, truncated body, publication and invalid excluded observations are hard failures', () => {
  const mutations = [
    (sample: Sample) => {
      sample.proof.tier = CacheTier.Local;
    },
    (sample: Sample) => {
      sample.proof.completeBody = false;
    },
    (sample: Sample) => {
      sample.proof.noPublication = false;
    },
    (sample: Sample) => {
      sample.valid = false;
      sample.excluded = 'warmup';
    },
  ];

  for (const mutation of mutations) {
    const documents = fixture();
    mutation(sampleAt(documents));
    assert.equal(analyzeResults(documents).status, 'failed');
  }
});

test('missing and duplicate arms and mismatched bytes or digest cannot enter statistics', () => {
  const documents = fixture();
  documents[0]?.samples.pop();
  assert.ok(analyzeResults(documents).issues.includes('missing-pair-arm'));

  const duplicate = fixture();
  duplicate[0]?.samples.push(sampleAt(duplicate));
  assert.ok(analyzeResults(duplicate).issues.includes('duplicate-pair-arm'));

  for (const mutation of [
    (sample: Sample) => {
      sample.bytes += 1;
    },
    (sample: Sample) => {
      sample.proof.digest = 'c'.repeat(64);
    },
  ]) {
    const mismatch = fixture();
    mutation(sampleAt(mismatch));
    assert.ok(analyzeResults(mismatch).issues.includes('pair-payload-mismatch'));
  }
});

test('warmup and first access are reported separately and do not meet the sample minimum', () => {
  const documents = fixture(() => 0, [21, 21, 21]);
  for (const document of documents) {
    for (const sample of document.samples) {
      if (sample.pair === 20) {
        sample.excluded = 'warmup';
      }
    }
  }

  sampleAt(documents, 0, 40).excluded = 'first-access';

  const result = analyzeResults(documents);
  const group = measuredGroup(result.groups[0]);

  assert.equal(result.status, 'passed');
  assert.equal(group.evidence.pairs, 60);
  assert.deepEqual(group.excluded, { 'first-access': 1, warmup: 5 });
  assert.equal(group.excludedTimingsMs['first-access'].baseline.count, 1);
  assert.equal(group.excludedTimingsMs.warmup.candidate.count, 3);
});

test('different corpus, reference, runtime or declared job cannot be pooled', () => {
  for (const mutate of [
    (document: Result) => {
      document.corpusDigest = 'c'.repeat(64);
    },
    (document: Result) => {
      document.baseline.revision = 'c'.repeat(40);
    },
    (document: Result) => {
      document.runtime.region = 'fra';
    },
  ]) {
    const documents = fixture();
    const document = documents[1];
    if (!document) {
      throw new Error('Missing test document');
    }

    mutate(document);
    assert.ok(analyzeResults(documents).issues.includes('incompatible-cohort'));
  }

  const documents = fixture();
  sampleAt(documents).jobId = 'wrong-job';
  assert.ok(analyzeResults(documents).issues.includes('job-identity-mismatch'));
  assert.ok(validateResult({}).length > 0);
});

test('frozen attempt weights describe partial coverage and never hide per-profile regression', () => {
  const documents = fixture();
  for (const [job, document] of documents.entries()) {
    document.weights = { 'package-medium': 10, 'html-large': 1, 'unmeasured-profile': 89 };

    const secondary = fixture(() => 40)[job];
    if (!secondary) {
      throw new Error('Missing secondary fixture');
    }

    document.samples.push(
      ...secondary.samples.map((sample) => ({
        ...sample,
        profileId: 'html-large',
        bytes: 1000000,
      })),
    );
  }

  const report = analyzeResults(documents);
  assert(report.weighted);
  assert.equal(report.status, 'failed');
  assert.equal(report.weighted.productionRepresentative, false);

  const cohort = report.weighted.cohorts[0];
  assert(cohort);
  assert('candidate' in cohort);
  assert.equal(cohort.scope, 'configured-profile-subset');
  assert.equal(cohort.coverage.attemptFraction, 0.11);
  assert.equal(cohort.coverage.includedProfiles, 2);

  const packageGroup = measuredGroup(
    report.groups.find((group) => group.profileId === 'package-medium'),
  );
  const htmlGroup = measuredGroup(report.groups.find((group) => group.profileId === 'html-large'));
  const weightedTime = packageGroup.median.candidate * 10 + htmlGroup.median.candidate;
  const weightedBytes = 27341 * 10 + 1000000;

  assert.equal(cohort.candidate.attemptWeightedProfileMedianMs, weightedTime / 11);
  assert.equal(cohort.candidate.weightedBytesPerSecond, (weightedBytes * 1000) / weightedTime);
  assert.equal(
    cohort.candidate.byteWeightedProfileBytesPerSecond,
    ((10 * 27341 ** 2 * 1000) / packageGroup.median.candidate +
      (1000000 ** 2 * 1000) / htmlGroup.median.candidate) /
      weightedBytes,
  );
});

test('weighted descriptions keep concurrency, lane and store population separate', () => {
  const documents = fixture();
  for (const document of documents) {
    document.weights = { 'package-medium': 6 };
    document.samples.push(
      ...document.samples.map((sample) => ({ ...sample, concurrency: 3, population: 1000 })),
    );
    document.samples.push(
      ...document.samples
        .filter((sample) => sample.concurrency === 1)
        .map((sample): Sample => ({
          ...sample,
          lane: 'adapter-local',
          proof: { ...sample.proof, tier: CacheTier.Local },
        })),
    );
  }

  const result = analyzeResults(documents);
  assert(result.weighted);
  assert.equal(result.status, 'passed');
  assert.equal(result.weighted.cohorts.length, 3);

  for (const cohort of result.weighted.cohorts) {
    assert.equal(cohort.scope, 'all-configured-profiles');
  }

  const first = documents[0];
  if (!first) {
    throw new Error('Missing weighted fixture');
  }

  first.weights = { 'package-medium': 7 };
  assert.ok(analyzeResults(documents).issues.includes('incompatible-cohort'));
});

test('CLI persists a sanitized failure and returns failure status', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nx-statistics-'));

  try {
    const filename = join(directory, 'results.json');
    const documents = fixture();
    const document = documents[0];
    if (!document) {
      throw new Error('Missing test document');
    }

    document.failures.push('private-provider-error signed-url=https://private.example/token');
    await writeFile(filename, JSON.stringify(document));

    let stdout = '';
    await assert.rejects(async () => {
      try {
        await execFileAsync(process.execPath, ['--import', 'tsx', analyzerUrl.pathname, filename]);
      } catch (error) {
        if (error instanceof Error && 'stdout' in error && typeof error.stdout === 'string') {
          stdout = error.stdout;
        }

        throw error;
      }
    });

    const report = JSON.parse(stdout);
    assert.equal(report.status, 'failed');
    assert.deepEqual(report.issues, ['recorded-run-failure']);
    assert.doesNotMatch(stdout, /private|token|https/);
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).failures.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
