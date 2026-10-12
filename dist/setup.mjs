// src/filesystem.ts
import { constants } from "node:fs";
var OWNER_READ_WRITE = constants.S_IRUSR | constants.S_IWUSR;
var OWNER_FULL_ACCESS = OWNER_READ_WRITE | constants.S_IXUSR;
var GROUP_READ_EXECUTE = constants.S_IRGRP | constants.S_IXGRP;
var OTHER_READ_EXECUTE = constants.S_IROTH | constants.S_IXOTH;
var FilePermissions = Object.freeze({
  OwnerOnlyFile: OWNER_READ_WRITE,
  OwnerOnlyDirectory: OWNER_FULL_ACCESS,
  Executable: OWNER_FULL_ACCESS | GROUP_READ_EXECUTE | OTHER_READ_EXECUTE,
  ReadableFile: OWNER_READ_WRITE | constants.S_IRGRP | constants.S_IROTH,
  Mask: OWNER_FULL_ACCESS | GROUP_READ_EXECUTE | constants.S_IWGRP | OTHER_READ_EXECUTE | constants.S_IWOTH
});
var FileOpenMode = Object.freeze({
  Read: "r",
  ExclusiveWrite: "wx"
});

// src/units.ts
var KIBIBYTE = 1024;
var MEBIBYTE = KIBIBYTE * KIBIBYTE;
var GIBIBYTE = MEBIBYTE * KIBIBYTE;
var SECOND_MS = 1e3;
var MINUTE_MS = 60 * SECOND_MS;
var HOUR_MS = 60 * MINUTE_MS;
var HOURS_PER_DAY = 24;
var DAY_MS = HOURS_PER_DAY * HOUR_MS;

// src/config.ts
var CacheAccess = Object.freeze({ ReadOnly: "read-only", ReadWrite: "read-write" });
var CacheFailureMode = Object.freeze({ FailOpen: "fail-open", Strict: "strict" });
var DEFAULT_ARTIFACT_REGION = "ord";
var DEFAULT_MAX_DISK_BYTES = 10 * GIBIBYTE;
var DEFAULT_EXTRACTION_BYTES = 2 * GIBIBYTE;
var DEFAULT_MAX_ARCHIVE_BYTES = 512 * MEBIBYTE;
var MAX_ARCHIVE_METADATA_BYTES = 4 * KIBIBYTE;
var DEFAULT_RETENTION_HOURS = 7 * HOURS_PER_DAY;
var DEFAULT_RETENTION_MS = DEFAULT_RETENTION_HOURS * HOUR_MS;
var DEFAULT_LOCAL_DISK_BYTES = DEFAULT_MAX_DISK_BYTES - DEFAULT_EXTRACTION_BYTES;

// src/setup.ts
import { appendFile, mkdir, writeFile, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
var HOME_DIRECTORY_PREFIX = "~/";
var action = process.env.GITHUB_ACTION_PATH;
var githubPath = process.env.GITHUB_PATH;
var githubEnv = process.env.GITHUB_ENV;
if (!action || !githubPath || !githubEnv) {
  throw new Error("Expected GitHub Actions environment");
}
var rawDirectory = process.env.INPUT_ARCHIVE_DIRECTORY ?? "~/.cache/nx-namespace";
var directory = resolve(
  rawDirectory.startsWith(HOME_DIRECTORY_PREFIX) ? join(homedir(), rawDirectory.slice(HOME_DIRECTORY_PREFIX.length)) : rawDirectory
);
var values = {
  NX_ARCHIVE_DIRECTORY: directory,
  NX_ARTIFACT_PREFIX: process.env.INPUT_ARTIFACT_PREFIX ?? "",
  NX_ARTIFACT_REGION: process.env.INPUT_ARTIFACT_REGION ?? DEFAULT_ARTIFACT_REGION,
  NX_CACHE_ACCESS: process.env.INPUT_ACCESS ?? CacheAccess.ReadOnly,
  NX_CACHE_FAILURE_MODE: CacheFailureMode.FailOpen
};
for (const value of Object.values(values)) {
  if (/[\r\n]/.test(value)) {
    throw new Error("Invalid multiline action input");
  }
}
var bin = join(action, ".output", "bin");
var distribution = join(action, "dist");
await mkdir(bin, { recursive: true });
async function writeLauncher(name, bundle) {
  const launcher = join(bin, name);
  await writeFile(
    launcher,
    `#!/usr/bin/env node
import(${JSON.stringify(join(distribution, bundle))});
`,
    { mode: FilePermissions.Executable }
  );
  await chmod(launcher, FilePermissions.Executable);
}
await writeLauncher("nscloud-nx-cache-action", "nscloud-nx-cache-action.mjs");
await writeLauncher("nx-namespace-token", "token.mjs");
await appendFile(githubPath, `${bin}
`);
await appendFile(
  githubEnv,
  Object.entries(values).map(([key, value]) => `${key}=${value}
`).join("")
);
