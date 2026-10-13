# Nx Cache Adaptor for Namespaces

While Namespace has Turborepo support, we use Nx within our monorepo, for its more
powerful management features beyond caching builds. Since Namespace didn't have
support for Nx, we've decided to add it ourselves! We hope other Namespace
customers who are also users of Nx, benefit from this work.

An Nx HTTP cache adapter backed by local archives and Namespace Artifact Storage.
On Namespace runners, the local archive directory can use an NVMe Cache Volume;
Artifact Storage provides shared entries when the current volume snapshot misses.
Nx owns task selection, hashing, archive creation and output restoration.

## Requirements

- Node.js 24.x. Development and benchmarks pin Node 24.21.0.
- Nx with the self-hosted HTTP cache protocol. Integration is tested with Nx 23.2.1;
  compatibility with other versions is unverified.
- Cacheable Nx targets with declared inputs and outputs.
- A Namespace workspace and Artifact permissions for remote caching. Local-only
  operation does not need Namespace credentials.

The adapter is distributed as a GitHub Action and standalone executable, rather
than an npm package. It does not install Nx or configure your task graph.

## GitHub Actions

Use a Namespace runner with an existing profile and permissions to publish cache
entries. For security, we recommend you pin the adapter to a reviewed full commit
SHA. This example runs on main; configure provider permissions and volume commit
policy for the same trusted branch.

```yaml
name: Build
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: namespace-profile-linux-default
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.21.0
          package-manager-cache: false
      - run: corepack enable
      - uses: namespacelabs/nscloud-cache-action@1124a6f3ce44e5cf84cc22111530961f4d2a15f9 # v1.7.0
        with:
          cache: pnpm
          path: ~/.cache/nx-namespace
      - run: pnpm install --frozen-lockfile
      - uses: monoai-labs/nscloud-nx-cache-action@v0.1.0
        with:
          archive-directory: ~/.cache/nx-namespace
          artifact-prefix: nx/v1/owner/repository
          access: read-write
      - run: nscloud-nx-cache-action pnpm exec nx run-many -t build
```

Use `access: read-only` for consumers that must not write. The action configures
launchers and environment variables; the listener runs only during the wrapped
command. Provider credentials and volume policy must enforce the intended access.

## Standalone and local use

Download both executables, `SHA256SUMS`, `LICENSE`, `NOTICE` and
`THIRD_PARTY_LICENSES.txt` from a pinned [release](https://github.com/monoai-labs/nscloud-nx-cache-action/releases).
With all listed files together, verify and run:

```sh
sha256sum --check SHA256SUMS
NX_ARCHIVE_DIRECTORY="$HOME/.cache/nx-namespace" \
  node ./nscloud-nx-cache-action.mjs pnpm exec nx run-many -t build
```

On macOS, use `shasum -a 256 --check SHA256SUMS`. Omitting `NX_ARTIFACT_PREFIX`
selects local-only caching. See [operations](docs/operations.md) for remote
credentials, hosted builds and troubleshooting.

## Documentation

- [Configuration](docs/configuration.md): action inputs, environment variables and defaults.
- [Operations](docs/operations.md): storage, credentials, failures and releases.
- [Benchmarking](docs/benchmarking.md): restoration profiles, regression paths and tracing.
- [Contributing](CONTRIBUTING.md): setup, checks and integration tests.

First-party code is [MIT licensed](LICENSE). Bundled dependencies retain their
original licenses; see [NOTICE](NOTICE) and [third-party licenses](THIRD_PARTY_LICENSES.txt).
