/**
 * Generate the deterministic Nx/pnpm workspace used by the integration checks.
 * A known dependency graph, codegen task and execution log make cache reuse and
 * invalidation observable without relying on an application repository.
 *
 * Run: pnpm fixture, or:
 * pnpm exec tsx scripts/generate-fixture.ts <dir> <projects> <modules>
 * Defaults come from fixtures/integration/model.json. Writes a Git workspace at
 * fixtures/integration/workspace/ unless a directory is supplied; install it before checks.
 */

import type { FixturePackage } from './fixture-types.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const MIN_FIXTURE_PROJECTS = 8;
const MAX_FIXTURE_PROJECTS = 128;
const MAX_MODULES_PER_PROJECT = 2000;

const root = resolve(process.argv[2] ?? 'fixtures/integration/workspace');

const model: { projects: number; modules: number } = JSON.parse(
  await readFile('fixtures/integration/model.json', 'utf8'),
);
const count = Number(process.argv[3] ?? model.projects);
const modules = Number(process.argv[4] ?? model.modules);
if (
  !Number.isInteger(count) ||
  count < MIN_FIXTURE_PROJECTS ||
  count > MAX_FIXTURE_PROJECTS ||
  !Number.isInteger(modules) ||
  modules < 1 ||
  modules > MAX_MODULES_PER_PROJECT
) {
  throw new Error('Invalid fixture size');
}

await mkdir(root, { recursive: true });

const inventory: string[] = [];

async function put(file: string, content: string) {
  await mkdir(resolve(root, file, '..'), { recursive: true });
  await writeFile(join(root, file), content);
  inventory.push(file);
}

async function json(file: string, value: unknown) {
  await put(file, JSON.stringify(value, null, 2) + '\n');
}

// Synthetic @fixture/* projects cover a dependency diamond, a source-only library
// (ui), code generation (contracts), a leaf consumer (app) and an unrelated branch.
const graph: Record<string, string[]> = {
  base: [],
  ui: [],
  left: ['base', 'ui'],
  right: ['base'],
  diamond: ['left', 'right'],
  contracts: ['base'],
  app: ['diamond', 'contracts', 'ui'],
  independent: [],
};
for (let i = MIN_FIXTURE_PROJECTS; i < count; i++) {
  graph[`consumer-${i}`] = [i % 2 ? 'diamond' : 'app'];
}

await json('package.json', {
  name: 'cache-fixture',
  private: true,
  type: 'module',
  packageManager: 'pnpm@11.22.0',
  devDependencies: { nx: '23.2.1', esbuild: '0.28.2' },
});

await put(
  'pnpm-workspace.yaml',
  'packages:\n  - packages/*\nallowBuilds:\n  nx: true\n  esbuild: true\n',
);
await put('.gitignore', 'node_modules/\n.nx/\n**/dist/\n**/.generated/\nexecutions.jsonl\n');

await json('nx.json', {
  namedInputs: {
    default: ['{projectRoot}/**/*', '!{projectRoot}/dist/**/*', '!{projectRoot}/.generated/**/*'],
    production: ['default'],
  },
  targetDefaults: {
    build: {
      cache: true,
      dependsOn: ['^build'],
      inputs: [
        'production',
        '^production',
        '{workspaceRoot}/scripts/build.mjs',
        { env: 'BUILD_MODE' },
      ],
      outputs: ['{projectRoot}/dist'],
    },
    generate: {
      cache: true,
      inputs: ['{workspaceRoot}/scripts/generate.mjs'],
      outputs: ['{projectRoot}/.generated'],
    },
  },
});

await put(
  'scripts/build.mjs',
  String.raw`/**
 * Build one fixture project's output and record the actual executor invocation.
 * Integration checks use this log to distinguish builds from cache restoration.
 * Run by Nx from a fixture package directory.
 */
import { build } from 'esbuild';
import { appendFile } from 'node:fs/promises';
import { basename } from 'node:path';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'dist/index.js',
  minify: true,
  define: { 'process.env.BUILD_MODE': JSON.stringify(process.env.BUILD_MODE ?? 'default') },
});

await appendFile(
  '../../executions.jsonl',
  JSON.stringify({ project: basename(process.cwd()), task: 'build' }) + '\n',
);
`,
);

await put(
  'scripts/generate.mjs',
  String.raw`/**
 * Generate the contracts fixture's schema and record the codegen invocation.
 * A separate generated input lets integration checks verify codegen invalidation.
 * Run by Nx from the contracts package directory.
 */
import { mkdir, writeFile, appendFile } from 'node:fs/promises';

await mkdir('.generated', { recursive: true });
await writeFile('.generated/schema.ts', 'export const schemaVersion = 1;\n');

await appendFile(
  '../../executions.jsonl',
  JSON.stringify({ project: 'contracts', task: 'generate' }) + '\n',
);
`,
);

for (const [name, deps] of Object.entries(graph)) {
  const scripts: Record<string, string> =
    name === 'ui' ? {} : { build: 'node ../../scripts/build.mjs' };
  if (name === 'contracts') {
    scripts.generate = 'node ../../scripts/generate.mjs';
  }

  const packageJson: FixturePackage = {
    name: `@fixture/${name}`,
    version: '1.0.0',
    type: 'module',
    private: true,
    exports: name === 'ui' ? './src/index.ts' : './dist/index.js',
    scripts,
    dependencies: Object.fromEntries(deps.map((d) => [`@fixture/${d}`, 'workspace:*'])),
    ...(name === 'contracts'
      ? {
          nx: {
            namedInputs: { production: ['default', '{workspaceRoot}/scripts/generate.mjs'] },
            targets: {
              build: {
                dependsOn: ['^build', 'generate'],
                inputs: [
                  'production',
                  '^production',
                  '{workspaceRoot}/scripts/build.mjs',
                  '{workspaceRoot}/scripts/generate.mjs',
                  { env: 'BUILD_MODE' },
                ],
              },
            },
          },
        }
      : {}),
  };
  packageJson.nx ??= {};
  packageJson.nx.targets ??= {};
  for (const task of Object.keys(scripts)) {
    packageJson.nx.targets[task] = {
      ...packageJson.nx.targets[task],
      executor: 'nx:run-commands',
      options: { command: `pnpm run ${task}`, cwd: `packages/${name}` },
    };
  }

  await json(`packages/${name}/package.json`, packageJson);
  const lines = deps.map(
    (dep, i) =>
      `import {value as d${i}} from '../../${dep}/${dep === 'ui' ? 'src/index.ts' : 'dist/index.js'}';`,
  );
  if (name === 'contracts') {
    lines.push("import {schemaVersion} from '../.generated/schema.ts';");
  }

  for (let i = 0; i < modules; i++) {
    await put(
      `packages/${name}/src/module-${i}.ts`,
      `export function f${i}(n: number) {
  return Array.from({ length: 32 }, (_, j) => Math.sin(n + j + ${i}))
    .reduce((a, b) => a + b, 0);
}
`,
    );
    lines.push(`import {f${i}} from './module-${i}.ts';`);
  }

  const dependencyValues = deps.map((_, i) => `d${i}`).join(',');
  const moduleValues = Array.from({ length: modules }, (_, i) => `f${i}(${i})`).join(',');
  const identity = name === 'contracts' ? 'schemaVersion' : JSON.stringify(name);
  lines.push(`export const value =
  [${dependencyValues}].join('') +
  [${moduleValues}].join(',') +
  ${identity} +
  process.env.BUILD_MODE;`);
  await put(`packages/${name}/src/index.ts`, lines.join('\n') + '\n');
}

await json('fixture-manifest.json', { projects: graph, modules, files: inventory });
execFileSync('git', ['init', '-b', 'main', root], { stdio: 'pipe' });
console.log(root);
