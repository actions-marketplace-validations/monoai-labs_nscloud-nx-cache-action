/**
 * Validate repository configuration and fixture manifests against vendored schemas.
 * Using the same schemas in pnpm check and the pre-commit hook catches invalid
 * tooling, workflow and fixture settings before they reach a runner.
 *
 * Run: pnpm config:check from the repository root. Reads configs; writes no files.
 */

import type { ValidateFunction } from 'ajv';
import { readFileSync, readdirSync } from 'node:fs';
import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';

const JSON_SCHEMA_DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const VALIDATION_OPTIONS = { strict: false, allErrors: true, validateFormats: false };

const validator = new Ajv(VALIDATION_OPTIONS);
const modernValidator = new Ajv2020(VALIDATION_OPTIONS);
validator.addSchema(JSON.parse(readFileSync('schemas/pre-commit-hooks.schema.json', 'utf8')));

const compiled: Map<string, ValidateFunction<unknown>> = new Map();

const actionValidator = validator.compile(
  JSON.parse(readFileSync('schemas/github-action.schema.json', 'utf8')),
);
if (!actionValidator(parse(readFileSync('action.yml', 'utf8')))) {
  throw new Error(validator.errorsText(actionValidator.errors));
}

const entries: [string, string][] = [
  ['tsconfig.json', 'schemas/tsconfig.schema.json'],
  ['pnpm-workspace.yaml', 'schemas/pnpm-workspace.schema.json'],
  ['.github/actionlint.yaml', '.github/actionlint.schema.json'],
  ['.oxlintrc.json', 'schemas/oxlint.schema.json'],
  ['.oxfmtrc.json', 'schemas/oxfmt.schema.json'],
  ['.pre-commit-config.yaml', 'schemas/pre-commit.schema.json'],
  ['fixtures/integration/model.json', 'schemas/fixture.schema.json'],
  ['fixtures/restoration/profile.json', 'schemas/restoration-profile.schema.json'],
];
for (const name of readdirSync('.github/workflows')) {
  if (/\.ya?ml$/.test(name)) {
    entries.push([`.github/workflows/${name}`, 'schemas/github-workflow.schema.json']);
  }
}

for (const [file, schema] of entries) {
  const definition = JSON.parse(readFileSync(schema, 'utf8'));
  const data = file.endsWith('.json')
    ? JSON.parse(readFileSync(file, 'utf8'))
    : parse(readFileSync(file, 'utf8'));

  const engine = definition.$schema === JSON_SCHEMA_DRAFT_2020_12 ? modernValidator : validator;
  const check = compiled.get(schema) ?? engine.compile(definition);
  compiled.set(schema, check);
  if (!check(data)) {
    throw new Error(`${file}: ${validator.errorsText(check.errors)}`);
  }
}

console.log(`Configuration schemas passed`);
