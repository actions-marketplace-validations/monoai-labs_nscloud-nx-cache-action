# Benchmarking

The suite measures adapter restoration and exercises storage regressions. Nx graph
construction, task hashing and executor performance are outside its scope.

## Offline regression paths

```sh
pnpm bench:restoration:offline
```

Results are written to `results/restoration-offline.json`. Nineteen scenarios cover
five paths:

| Path | Coverage |
| --- | --- |
| Local restoration | Hits, local misses and remote misses. |
| Publication drain | Local acceptance, shared durability, canonical conflicts and bounded/coalesced publication. |
| Disk admission | Eviction, reservation release and inventory scans. |
| Queue and cancellation | Request/queue deadlines, client abort and overload. |
| Outage and corruption | Repair, integrity rejection, fail-open/strict policy and child status. |

These use deterministic doubles. Timings are smoke diagnostics; they do not qualify
Artifact Storage, NVMe performance or p95 regressions.

## Workload corpus

`fixtures/restoration/profile.json` is generated entirely from the recipes in
`bench/restoration/synthetic-profile.ts`. It contains nine ordinary workload shapes
and seven stress shapes. No source archives, measured profiles, private commit
identifiers or previous benchmark results are included.

The ordinary mix uses explicit, rounded design weights:

| Shape | Weight | Expanded output |
| --- | ---: | ---: |
| Empty, metadata and terminal-only outputs | 20% combined | No output files |
| Tiny library | 5% | About 6 KiB |
| Small library | 20% | 44 KiB |
| Medium library | 20% | 88 KiB |
| Large library | 15% | 352 KiB |
| Generated site | 10% | 1 MiB |
| Large generated site | 10% | 2 MiB |

Library shapes contain JavaScript, source maps and declarations; site shapes contain
HTML, JSON and CSS. The stress shapes cover an 8 MiB file, incompressible payloads,
512 tiny files, a 16-level tree, mixed executable/readable permissions, large terminal
output, and zero-byte files with empty directories. Stress shapes have zero workload
weight and are included only with `--all`; report their results separately.

Nx's native serializer produces each archive. Generation checks topology, modes,
file sizes and expanded bytes, with a 10% compressed-size tolerance. Tests reproduce
the complete profile JSON from the recipes before qualifying every generated archive.
The analyzer rejects comparisons using different corpus digests.

These fixtures cover controlled workload characteristics, not a production arrival
sequence or a claim of exhaustive application coverage. Assess component documentation
builds, hosted deployments, broader traffic and platform-specific outputs separately.
Weighted summaries are designed workload summaries, not measured production percentiles.

Regenerate profiles and exercise all shapes:

```sh
pnpm exec tsx bench/restoration/synthetic-profile.ts
pnpm exec tsx bench/restoration/fixture.ts .output/restoration-corpus --all
```

The profiler also supports private local coverage comparisons:

```sh
pnpm exec tsx bench/restoration/profile.ts archive /path/to/archive
```

Its output still contains exact sizes and topology. Keep that output, source archives,
measurement logs and coverage comparisons outside the public repository. A profile
without filenames is not automatically suitable for publication.

## Bundle controls and Namespace runs

The `Cache restoration` workflow runs offline checks on pull requests and main pushes. Its default
manual mode validates two isolated candidate copies across three Namespace jobs,
including body/digest, tier, persisted archive, native extraction and cleanup proofs.
It also runs the credential, publication and cross-job integration checks.
Set `live=false` to run only offline checks.

`Cache restore performance` compares the untraced candidate against a reference
selected by a full public commit SHA in `baseline_revision`. Set `tracing=false` for
that comparison. The default `tracing=true` compares identical bundles with tracing
enabled only on the candidate, without downloading a reference. Inventory diagnostics
use separate synthetic populations of 1,024 and 16,384 entries.
Set the repository variable `NAMESPACE_RUNNER_PROFILE` to an existing Namespace
profile label; the default is `namespace-profile-linux-default`. Each suite appends
its own cache tag. `BENCH_REFERENCE_REPOSITORY` can select a public fork containing
the selected reference. `baseline.ts` requires a full commit SHA, fetches its committed
bundle and records the SHA-256 digest. Results bind both arms to their commit and digest.

For a local bundle control:

```sh
pnpm build
pnpm bench:restoration:live --offline --protocol restoration-perf-v1 --pairs 1 \
  --baseline .output/release/nscloud-nx-cache-action.mjs \
  --baseline-revision "$(git rev-parse HEAD)" \
  --candidate-revision "$(git rev-parse HEAD)" \
  --output results/local-control.json
```

Local controls verify the harness; they do not establish Namespace performance.
To compare a different version, set `BENCH_BASELINE_REVISION` to its full public commit
SHA, run `pnpm exec tsx bench/restoration/baseline.ts`, then supply the downloaded
`.output/benchmark-baseline/nscloud-nx-cache-action.mjs` and that revision to the controller.
The manual `validation_only=false` mode also requires `baseline_revision`.

Remote measurements use an absent client archive and finalized synthetic Artifacts.
Both bundles consume identical bytes in recorded randomized order, at concurrency
one and three. Three is a controlled parameter, not observed traffic. Synthetic
objects live beneath benchmark-owned prefixes and expire after three hours. The
controller removes only its own local state and reaps its own workers.

## Analysis and tracing

Download every ordinary block result, then analyze with:

```sh
pnpm exec tsx bench/restoration/analyze.ts results/block-1.json results/block-2.json results/block-3.json > results/analysis.json
```

Use `pnpm exec tsx` when capturing JSON: package-script failure messages can corrupt
redirected output. The analyzer returns nonzero for failed, incomplete or inconclusive
comparisons. Retain failures, warmups and first-access samples. Performance margins
are 10% / 10 ms for median and 15% / 25 ms for p95, as defined by the frozen protocol;
retain three independent job blocks and confidence intervals. Exclude inventory
stress blocks from ordinary-workload aggregation. A timeout does not justify fewer
samples or wider acceptance thresholds.

`NX_CACHE_TRACE=1` emits request IDs, hashes, monotonic spans and numeric counters.
Tracing is disabled by default and its overhead remains unqualified. Inclusive
body, receive and write intervals overlap; adding them overstates wall time. Body
time includes write backpressure. The controller records Linux adapter-process CPU,
RSS, lifetime peak RSS and I/O counters outside client timing.

```sh
pnpm exec tsx bench/restoration/trace-analysis.ts results/block.trace.json results/block.json results/block.stages.json
```

Client duration includes full HTTP consumption and digest checking. Native retrieval
includes HTTP and extraction, excluding output verification. Neither measures Nx
graph scheduling. Qualify restore performance and tracing overhead on actual Namespace
runners before making performance claims. Offline checks establish correctness only.
