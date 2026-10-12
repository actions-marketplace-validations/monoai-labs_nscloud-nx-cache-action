# Contributing

## Setup and checks

Install the versions in `mise.toml` and the pnpm version in `package.json`:

```sh
mise install
mise exec -- env PATH="$(mise where node)/bin:$PATH" corepack pnpm install --frozen-lockfile
mise exec -- env PATH="$(mise where node)/bin:$PATH" corepack pnpm check
mise exec -- env PATH="$(mise where node)/bin:$PATH" corepack pnpm bench:restoration:offline
```

The explicit PATH keeps Corepack and package-script children on the pinned Node.
With the mise shims active, subsequent commands can use `pnpm` directly. `pnpm check`
validates configuration schemas, Oxfmt formatting, Oxlint, TypeScript and tests,
including reproducible bundling and execution outside the checkout without
`node_modules`.

* Run `pnpm format` to format maintained TypeScript, and `pnpm lint:fix` to apply
lint fixes.
* Keep scripts, tests and benchmarks in TypeScript. Use braces for
control flow.
* Group related lines into logical paragraphs: keep a value with its
guards, an operation with its assertions, and resource acquisition with the block
that protects its lifetime.
* Use blank lines when moving to another phase or test
scenario, and between methods.
  * Oxfmt preserves those breaks; it cannot choose them
for you.
* Generated bundles, workspaces, schemas and measurement output are excluded
from source linting and formatting.
* Start scripts and benchmark modules with a short header explaining their purpose,
why they exist, and how they are invoked.
  * Include prerequisites and generated outputs when relevant.

Configuration schemas are vendored in `schemas/` and checked by `pnpm config:check`;
run `mise exec -- pre-commit install` to enable the local schema validation hook. Refresh the Oxlint and Oxfmt schemas from their packages when updating those tools.

Run `mise exec -- actionlint` for workflow changes. Local checks and CI use the
Astral fork at the commit pinned in `mise.toml`, built with the pinned Go version.
Build with `pnpm build`; include
generated `dist/` changes when source changes alter a bundle. Keep commits focused
and explain changed behavior and validation in pull requests.

## Integration checks

The generated workspace exercises dependency ordering, source/generated/lockfile
invalidation, failed tasks and actual Nx output restoration:

```sh
pnpm fixture
pnpm --dir fixtures/integration/workspace install
pnpm integration:contracts
pnpm integration:restoration
pnpm build
pnpm exec tsx scripts/bundle-proof.ts
```

Local restoration omits the remote tier unless `NX_ARTIFACT_PREFIX` is supplied.
Use dedicated test-owned directories and prefixes for live checks.

The manual `Namespace cache integration` workflow verifies scoped credentials,
concurrent immutable publication, unfinished-upload invisibility, packaged bundle
restoration and two fresh consumers on Namespace. Configure the Namespace runner
profile and Cloud GitHub OIDC integration before running it. The manual `Failed job
Artifact persistence` workflow intentionally fails its writer job after finalization;
its later reader must pass. Its overall failed conclusion is expected.

Pull requests run credential-free checks on GitHub-hosted runners. Live Namespace
checks run only by manual dispatch or an explicitly invoked reusable workflow.
Keep [benchmark](docs/benchmarking.md) correctness gates and statistical limitations
intact when changing the harness.

## Scope and distributions

The connector owns archive transport and storage. Preserve Nx's task graph, input
hashing and archive format, plus integrity checks, access policy and child exit codes.
Remove only resources created by the current test. Keep credentials, signed URLs,
raw archives and unsanitized errors out of logs and committed fixtures.

First-party code is MIT licensed. Bundled dependencies retain their original
licenses. When dependencies change, update `NOTICE` and `THIRD_PARTY_LICENSES.txt`
and include these with every distributed executable. The release workflow prepares a draft with
both executables, license notices and a checksum manifest from main.

Keep plans, generated workspaces and measurement output untracked. User guides
describe current behavior; experiment logs and internal rollout history belong
outside the repository.
