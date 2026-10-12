# Nx Cache Adaptor for Namespaces

Read `mise.toml` and [Contributing](CONTRIBUTING.md) before running commands. Use
the pinned Node and pnpm versions. Run `pnpm check` before committing; run actionlint
for workflow changes and the offline suite for benchmark/storage changes.

The connector owns opaque archive transport and storage; Nx owns graph construction,
hashing and task execution. Preserve integrity, authorization and child exit status.
Use typed APIs rather than assertions that suppress incompatibilities.

Keep credentials, signed URLs, raw archives and unsanitized errors out of logs.
Preserve temporary-resource ownership and remove only resources created by the
current test. Test Namespace behavior on actual runners; local filesystems do not
prove NVMe snapshot behavior. Record benchmark coverage and unresolved limitations.

Keep commits focused, preserve unrelated changes and existing Git identity, and
omit attribution footers. Plans and measurement results remain untracked. Update
usage documentation and dependency notices when their contracts change.

# Repository guidance

Follow [Contributing](CONTRIBUTING.md). Use the pinned
toolchain and retain the boundary between Nx task execution and archive storage.

In linked worktrees, `pnpm` can launch a Node version from outside the mise shims.
If its engine check reports a different version, use the explicit Corepack/PATH
invocation in `CONTRIBUTING.md` for installation and checks; verify with
`mise exec -- env PATH="$(mise where node)/bin:$PATH" corepack pnpm exec node --version`.

Follow redirects when downloading configuration schemas (`curl --fail --location`);
SchemaStore can return a redirect body that is HTML rather than JSON.
Vendor referenced schemas too and register them with Ajv before compiling the
parent schema; the pre-commit config schema requires `pre-commit-hooks.json`.

The corpus generator accepts custom and marginal-only surveys. Its input validator
must validate that structure rather than require the built-in synthetic recipes. Preserve ANSI
stripping in cache logs with an explicit escape character in the regex constructor;
literal control-character regexes fail Oxlint's `no-control-regex` rule.

Temporary scripts outside the checkout must resolve project dependencies from the
checkout's `package.json`, for example with `createRequire`. A script in `/tmp`
cannot resolve the project's TypeScript package through a bare import.
Oxlint's brace fixes can need another pass for nested unbraced statements; review
the remaining diagnostics and add the inner braces before running Oxfmt.

A freshly generated integration workspace has no lockfile. Its first install must
use `pnpm --dir fixtures/integration/workspace install --no-frozen-lockfile`; use
`--frozen-lockfile` only after that workspace's lockfile exists.

For an optional source secret scan, select the scanner version explicitly:
`mise exec gitleaks@8.30.1 -- gitleaks dir <export-directory> --redact`.
An installed mise shim without a selected version cannot run the scanner.

GitHub's organization app-installation endpoint requires `admin:org` scope.
Repository access alone cannot establish whether a runner integration is installed;
validate it with the repository's live workflow instead of inferring absence from a 404.

Nx archive entry order can differ between filesystems. Compare generated corpus
structure independently of tar entry order and apply the existing compressed-size
calibration tolerance; exact profile JSON equality is not a portable regeneration check.

Runner credentials can pass Artifact storage checks while failing IAM token issuance
with `Unauthenticated` (code 16). The credential proof deliberately exchanges GitHub
OIDC credentials and selects that token file. If exchange reports a missing Namespace
Cloud App, verify the integration at https://github.com/apps/namespace-cloud; a working
runner connection alone does not prove that exchange is configured.
