/**
 * Define the package and target shapes emitted by generate-fixture.ts.
 * These types keep generated manifests checked while allowing the small workspace
 * to express dependency ordering, build inputs and a separate codegen target.
 *
 * Imported by the generator; this module is not a command.
 */

export interface FixtureTarget {
  dependsOn?: string[];
  inputs?: (string | { env: string })[];
  executor?: string;
  options?: { command: string; cwd: string };
}

export interface FixturePackage {
  name: string;
  version: string;
  type: 'module';
  private: boolean;
  exports: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  nx?: {
    namedInputs?: Record<string, string[]>;
    targets?: Record<string, FixtureTarget>;
  };
}
