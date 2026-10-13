# Using the cache with Vercel

For a source deployment, GitHub runs the deployment command and Vercel runs the
application build. The cache executable must run around Nx **inside that build**.
The GitHub Action's PATH and environment changes stay in the GitHub job.

This guide uses an existing Nx/pnpm workspace, an application at `apps/web`, and
an Nx target named `web:build`. Substitute your application's path and target.
Use Node 24.x on Vercel; the connector is tested with Nx 23.3.0. Pin pnpm through
your root `packageManager` field and commit its lockfile. Configure Vercel's
[package-manager selection](https://vercel.com/docs/package-managers) to use that pin.

## Put the release files in the deployed source

Download the executables and notices from a reviewed
[release](https://github.com/monoai-labs/nscloud-nx-cache-action/releases), such as
v0.1.0. Keep the complete set together in your repository:

```text
tools/nx-cache/
  nscloud-nx-cache-action.mjs
  token.mjs
  SHA256SUMS
  LICENSE
  NOTICE
  THIRD_PARTY_LICENSES.txt
  vercel-build.sh
apps/web/vercel.json
```

Before committing the release files, verify them from `tools/nx-cache` with
`sha256sum --check SHA256SUMS`, or `shasum -a 256 --check SHA256SUMS` on macOS.
Copying the files also supports private releases that a hosted builder cannot
download. Keep a record of the reviewed release and commit when updating them.

Set the Vercel project's Root Directory to `apps/web` and enable
[source files outside the Root Directory](https://vercel.com/docs/monorepos/monorepo-faq).
Submit source from the workspace root so the lockfile, shared packages and cache
files are included. Check `.vercelignore` and Git ignore rules: if they exclude
your chosen bundle directory or `*.mjs`, add exceptions for these release files.

## Wrap the Nx build in Vercel

Create `tools/nx-cache/vercel-build.sh`:

```sh
#!/usr/bin/env sh
set -eu

cache_script_directory=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cache_workspace_root=$(CDPATH='' cd -- "$cache_script_directory/../.." && pwd)
cd "$cache_workspace_root"

export NX_ARCHIVE_DIRECTORY="$cache_workspace_root/node_modules/.cache/nx-namespace"
export NX_ARTIFACT_PREFIX="${NX_ARTIFACT_PREFIX:-nx/v1/your-org/your-repo}"

if [ -z "${NX_NAMESPACE_TOKEN:-}" ]; then
  unset NX_ARTIFACT_PREFIX
fi

exec node "$cache_script_directory/nscloud-nx-cache-action.mjs" \
  corepack pnpm exec nx "$@"
```

Replace `nx/v1/your-org/your-repo` with your repository's cache prefix. Use the
**same prefix and Artifact region** for CI and Vercel when they should share
entries. The region defaults to `ord`; use `NX_ARTIFACT_REGION` to override it.
Prefixes partition entries, while provider permissions enforce access.

The wrapper uses a workspace-local archive directory. Vercel does not mount a
Namespace NVMe Cache Volume; Artifact Storage supplies the shared tier. The
tokenless branch explicitly selects local-only caching, including Git-triggered
builds that have no issued credential.

Merge these commands into `apps/web/vercel.json`, retaining your framework,
output and other application settings:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "cd ../.. && corepack pnpm install --frozen-lockfile",
  "buildCommand": "sh ../../tools/nx-cache/vercel-build.sh run web:build"
}
```

This wrapper calls the Nx executable directly. If your existing `pnpm nx` script
already starts the connector, keep one wrapper rather than nesting them. Nx still
owns dependency builds and task selection. Only cache deterministic targets with
correct inputs and outputs; migrations and deployment side effects must execute
normally. An application build can remain uncached while reusing package builds.

## Send a short-lived credential with the source deployment

Connect the Namespace Cloud GitHub app for the deploying repository. The GitHub
OIDC identity must be allowed to issue and revoke Artifact credentials. Configure
Vercel's token and the IDs of an existing Vercel project in GitHub; pin the Vercel
CLI in your workspace's development dependencies.

This example runs from the workspace root on trusted main pushes. It uses the
copied token helper, so it does not require installing this GitHub Action or
mounting a Namespace volume in the deployment job:

```yaml
name: Deploy web
on:
  push:
    branches: [main]
permissions:
  contents: read
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      NX_CACHE_FAILURE_MODE: strict
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24.21.0
          package-manager-cache: false
      - run: corepack enable
      - run: corepack pnpm install --frozen-lockfile
      - uses: namespacelabs/nscloud-setup@df198f982fcecfb8264bea3f1274b56a61b6dfdc # v0.0.12
      - run: nsc auth exchange-github-token
      - name: Deploy source and wait for its build
        run: |
          NSC_TOKEN_FILE="$HOME/.config/ns/token.json" \
            node tools/nx-cache/token.mjs read-write \
            corepack pnpm exec vercel deploy --yes --prod \
            --build-env NX_NAMESPACE_TOKEN \
            --build-env NX_CACHE_FAILURE_MODE=strict
```

`--build-env NX_NAMESPACE_TOKEN` forwards the credential from the token helper's
child environment to Vercel's build. Do not use `--env` or persist this token in
Vercel project settings. Vercel distinguishes
[build variables from runtime variables](https://vercel.com/docs/cli/deploy#build-env).
The example uses strict mode for both issuance and the hosted cache, so an access
failure cannot look like successful cache qualification. After qualification,
choose fail-open if builds should proceed when caching is unavailable.

The helper revokes the credential when its child exits, and its maximum lifetime
is one hour. Keep that child running until the remote build finishes. Do not add
[`--no-wait`](https://vercel.com/docs/cli/deploy#no-wait); an API-based deployment
client must poll for build completion before returning too. Build queue time
counts toward the credential lifetime. Do not print the token or enable shell
tracing around credential handling.

For trusted previews, remove `--prod` and deliberately choose the preview's
publication policy. To prevent shared publication, issue a `read-only` token and
pass `--build-env NX_CACHE_REMOTE_ACCESS=read-only`; this retains local writes.
Setting `NX_CACHE_ACCESS=read-only` also disables local archive writes. Use your
existing deployment admission rules for untrusted branches and forks. Choose
which deployment system owns each environment to avoid duplicate CLI and native
Git builds.

## Validate the hosted path

First qualify a non-production deployment with strict cache failure mode:

1. Confirm the uploaded source contains the reviewed executable and that the
   build log shows the wrapper invoking your intended Nx target.
2. Check for successful Artifact publications from eligible cacheable targets.
3. Start a fresh source deployment with unchanged task inputs. Confirm Artifact
   hits, matching restored outputs, and no executor runs for those targets. A
   framework build or unrelated uncached task may still run.
4. Change a declared input and confirm the affected task executes again.
5. Confirm the deployment request has a build-only cache credential, and that
   the deployment client waits through the build before the helper exits.

Successful deployment alone is not evidence of caching: fail-open mode can build
everything normally after a cache failure. The connector writes structured
events to build stderr; Vercel does not provide GitHub step summaries. Keep the
prefix and region consistent and check that every intended task declares caching.

For `vercel build` followed by `vercel deploy --prebuilt`, the build runs in your
CI environment instead. `vercel build` executes the configured build command,
which starts the Nx wrapper there. Give the build process its cache credential
and hold that credential until the local build finishes; do not add another cache
wrapper around `vercel build`. The prebuilt upload performs no remote Nx build
and needs no cache credential. Fetch the project's settings with `vercel pull`
before building, as described in
[Vercel's local build documentation](https://vercel.com/docs/cli/build).
