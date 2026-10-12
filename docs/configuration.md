# Configuration

## GitHub Action inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `archive-directory` | `~/.cache/nx-namespace` | Existing archive directory; mount it before using the action. |
| `artifact-prefix` | Required | Repository and protocol prefix in Namespace Artifact Storage. |
| `artifact-region` | `ord` | Namespace storage region. |
| `access` | `read-only` | `read-only` rejects all uploads; `read-write` enables them. |

The action sets `NX_CACHE_FAILURE_MODE=fail-open` and exposes `nscloud-nx-cache-action`
and `nx-namespace-token` on PATH. Override environment variables on the wrapped
command step when needed. Node 24 must already be installed.

## Environment variables

These settings apply when invoking the standalone executable or action launcher.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NX_ARCHIVE_DIRECTORY` | Required | Persistent local archive directory. |
| `NX_ARTIFACT_PREFIX` | Unset | Enables Artifact Storage; unset means local-only. |
| `NX_ARTIFACT_REGION` | `ord` | Artifact Storage region. |
| `NX_NAMESPACE_TOKEN` | Unset | Explicit Namespace bearer token; otherwise use workload/default SDK credentials. |
| `NX_CACHE_ACCESS` | `read-write` | `read-only` rejects every PUT, including local writes. The action sets `read-only` by default. |
| `NX_CACHE_REMOTE_ACCESS` | `read-write` | `read-only` allows local writes and Artifact reads, but skips remote publication. |
| `NX_CACHE_FAILURE_MODE` | `fail-open` | `strict` reports cache startup, request and publication failures. |
| `NX_CACHE_DISK_BYTES` | `10737418240` (10 GiB) | Combined archive and extraction allowance. |
| `NX_CACHE_EXTRACTION_BYTES` | `2147483648` (2 GiB) | Nx extraction-cache cleanup threshold, subtracted from the combined allowance. |
| `NX_CACHE_ARCHIVE_BYTES` | `536870912` (512 MiB) | Maximum individual archive size. |
| `NX_CACHE_RETENTION_HOURS` | `168` | Local archive retention. |
| `NX_CACHE_TRACE` | Unset | Set exactly `1` to emit request-scoped diagnostic spans. |

Numeric settings must be positive safe integers. The archive allowance must exceed
the maximum individual archive size by at least 4096 bytes. Cleanup thresholds do
not impose filesystem quotas on arbitrary build outputs.

Credential discovery uses `NX_NAMESPACE_TOKEN` first, then a Namespace workload
token at `/var/run/nsc/token.json`, then SDK defaults such as `NSC_TOKEN_FILE`.
Tokens must remain in the process environment or credential file, outside logs.

## Command behavior

```sh
NX_ARCHIVE_DIRECTORY="$HOME/.cache/nx-namespace" \
NX_ARTIFACT_PREFIX="nx/v1/owner/repository" \
NX_CACHE_REMOTE_ACCESS=read-only \
  node ./nscloud-nx-cache-action.mjs pnpm exec nx run-many -t build
```

Each invocation starts an authenticated IPv4 loopback listener and sets Nx's
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER` and access token for the child. The wrapper
disables the Nx daemon and gives the child fresh workspace metadata and extraction
directories. It removes these directories after the child and publication drain
finish; archives in `NX_ARCHIVE_DIRECTORY` persist.

Use one connector process per archive directory. Concurrent Nx tasks within that
command share the listener. Access flags are client policy; they do not restrict
what the underlying Namespace identity or mounted filesystem can do.
