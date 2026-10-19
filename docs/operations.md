# Operations

## Storage

Mount persistent archives with [Namespace Cache Volumes](https://namespace.so/docs/architecture/storage/cache-volumes).
Volumes are forked snapshots; concurrent jobs do not merge every writer's changes.
[Artifact Storage](https://namespace.so/docs/architecture/storage/artifact-storage)
supplies immutable shared entries when a local snapshot misses. A successful job
does not guarantee a later job receives that archive through its volume snapshot.

Use a prefix such as `nx/v1/owner/repository` to separate repositories and protocol
versions. Prefixes are addresses, rather than authorization boundaries. Provider
permissions and volume commit restrictions must control which workloads can write.

Local archives use `entries-v1/<task-hash>/` with size, SHA-256 digest and timestamp
metadata. Writes flush both files before atomic directory publication; reads verify
regular files, size and digest. Admission reserves space before writing and evicts
least recently used archives. It inspects at most 16 inventory entries concurrently
while serializing admission. Abandoned partials older than one hour are removed.

HTTP PUT success acknowledges local admission and queued publication. The command
drains up to ten concurrent publications before exiting. Only successful completion
of that drain establishes shared durability. Task failure or cancellation retains
its exit status while accepted publications drain.

## Credentials and hosted builds

On Namespace runners, the SDK can use the workload credential. Elsewhere, provide
an Artifact credential through `NX_NAMESPACE_TOKEN` or the SDK's credential file.
Local-only builds can omit `NX_ARTIFACT_PREFIX` and credentials.

`token.mjs` runs a child with a one-hour Artifact-only credential and revokes it
after the child exits:

```sh
NSC_TOKEN_FILE="$HOME/.config/ns/token.json" \
  node ./token.mjs read-write <deploy-command> <arguments...>
```

The action exposes the same command as `nx-namespace-token`. The parent credential
must be authorized to issue and revoke tokens. `read-only` grants Artifact resolve;
`read-write` grants resolve and create. Grants apply across Artifact Storage in the
workspace; repository-path grants are unavailable. No compute or IAM grants are
added to the child token.

For GitHub OIDC, configure the Namespace Cloud GitHub app and exchange the GitHub
token with `nsc auth exchange-github-token` before running the token wrapper. For
hosted builds, forward the issued token only to the build environment. For example,
Vercel deployments can pass it as a build-only variable; keep it out of runtime and
persistent project environments. Carry the reviewed bundle and license files in
the deployed source when the build cannot download the release.

See the [Vercel integration guide](vercel.md) for a complete source-deployment
recipe, including the hosted build command, build-only token forwarding and
waiting for the build before revocation.

Cache permissions must be enforced by the provider. An HTTP read-only setting
cannot remove write permission from a runner identity or mounted volume.

## Failures and diagnostics

Fail-open is the default. Startup failure runs the child once with Nx caching
disabled; optional Artifact setup failure keeps local caching active. Failed GETs
become misses, failed PUTs can be acknowledged without storage, and publication
failure preserves a successful task status. A task is never rerun after it starts.
Use `NX_CACHE_FAILURE_MODE=strict` for validation and durability-sensitive callers.

Token issuance failure also defaults to fail-open, running the child with an empty
cache token. Revocation failure preserves the child status while the credential
expires. Strict mode reports either failure.

The listener admits 32 active requests and 128 queued requests. Queue and active
request deadlines are 120 seconds. Overload returns 503 in strict mode, or a miss
for GET / discarded-write acknowledgment for PUT in fail-open mode. Deadlines and
disconnects cancel incomplete input and remote reads.

| Symptom | Check |
| --- | --- |
| No adapter events | Confirm the command is wrapped, Nx supports the HTTP protocol, and target caching is enabled. |
| Repeated misses | Check Nx inputs/outputs, prefix, credentials, region and archive retention. |
| Expected volume hit uses Artifact Storage | A snapshot may lack the entry; inspect the recorded tier. |
| Corruption | The invalid local entry is removed; Artifact recovery is attempted. Repeated failure needs storage investigation. |
| Disk admission failure | Check available space, archive/extraction allowances and maximum archive size. |
| Successful task with publication errors | Fail-open preserves task success. Reproduce with strict mode. |

Structured events on stderr identify operation, tier, hash, bytes, duration and
sanitized error codes. The GitHub step summary reports operation counts and I/O
totals after publication drain. These are neither Nx task counts nor workflow wall
time. Credentials, signed URLs, archive contents and raw errors must stay out of
logs. Optional tracing is described in [benchmarking](benchmarking.md).

## Releases

Build and check with the pinned toolchain described in [Contributing](../CONTRIBUTING.md).
Commit reproducibly generated `dist/` files and qualify the commit on Namespace.
Run the release workflow manually from main with a new `vMAJOR.MINOR.PATCH` tag
matching `package.json`. It checks the committed distribution and prepares a draft
release with executables, checksums and license notices.
Publish the draft after verifying its assets and qualifying the commit on Namespace.
Existing tags must remain immutable. Consumers pin a reviewed commit or verify a
pinned release's checksums.

Publishing a release also triggers this workflow. It checks out the tagged commit,
requires that commit to be in main's history, verifies the version and committed
bundles, and uploads any missing release files. Existing files must match the
reviewed build byte for byte; retries do not replace them. Wait for the workflow
to finish before using standalone downloads when creating a release without
prepared assets. The GitHub Action itself uses the committed `dist/` files.

Draft creation does not trigger GitHub Actions. Prefer the manual draft flow when
all downloads must be present at publication, including when GitHub release
immutability is enabled. The automatic workflow packages assets; it does not
change repository visibility, move version tags or create a Marketplace listing.

### First public publication

Keep the source import's fresh history. Do not push refs from a private predecessor
or copy measured workload profiles, archives or results into this repository.
Review every exposed branch and tag, release asset, issue and workflow artifact
before changing visibility; scan the Git history and distributed files for secrets.

Prepare a new patch release from the qualified main commit when metadata or docs
change. Verify the draft's checksums, license files and executable bytes against
the reviewed build. Record the Namespace and separate-repository consumer checks;
offline checks do not establish runner storage behavior. Keep existing releases
and tags unchanged.

After approval to publish, make this repository public and publish the reviewed
draft. Public workflows can then use `monoai-labs/nscloud-nx-cache-action@<tag>`
without private-repository sharing. Prefer a full commit SHA in usage examples.
Check access from an unauthenticated session and a separate consumer repository.

GitHub Marketplace is a separate listing step. Use the release page's **Publish
this Action to the GitHub Marketplace** option, with **Continuous integration**
as the primary category. The root `action.yml` supplies the name, description and
branding. GitHub validates name availability there; do not claim a listing until
that check passes. An organization owner must accept the Marketplace Developer
Agreement, and publishing requires two-factor authentication. Follow
[GitHub's publication instructions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace).

The repository description should describe local archives and Namespace Artifact
Storage; avoid latency or performance claims without published measurements.

### npm publishing

The CLI package is `@monoai/nscloud-nx-cache-action`. Stable release publication
also packs and publishes that version to npm after the audit, tests, reproducible
build and release-asset checks pass. The manual draft flow prepares the package
without publishing it. A retry verifies the existing npm tarball integrity and
skips publication only when the bytes match; lookup failures and conflicts fail.
After publishing, it waits up to five minutes for the new version to become readable
before verifying its integrity.

Configure the package's npm trusted publisher for GitHub owner `monoai-labs`,
repository `nscloud-nx-cache-action`, workflow `release.yml`, with direct
`npm publish` allowed. The workflow uses a GitHub-hosted runner and `id-token: write`;
it needs no npm token secret. The pinned Node distribution includes npm 11.19.0,
which supports OIDC. npm automatically adds provenance for the public package.
See [npm's trusted publisher instructions](https://docs.npmjs.com/trusted-publishers/).

If the package is not yet present on npm, its owner must complete the initial
publication and publisher setup before automated release publishing can succeed.
Configure the publisher close to the release: npm requires its first successful
publish within two days. Keep npm versions immutable, just like release tags.

Verify packaging locally with `pnpm build` and `pnpm package:pack`. The package test
installs the actual tarball into an isolated workspace and exercises both binaries.
Only the two executables, public guides, package metadata and license notices ship.
TypeScript remains strictly checked; there is no importable library API or fabricated
declaration file. Minification preserves function/class names and legal comments.
