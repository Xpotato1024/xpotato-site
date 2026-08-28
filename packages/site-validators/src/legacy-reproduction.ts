import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { normalizeBuiltFileToEndpoint } from "./legacy-inventory.js";

export interface LegacyDistManifestEntry {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface LegacyDistManifest {
  readonly schemaVersion: 1;
  readonly files: readonly LegacyDistManifestEntry[];
  readonly fileCount: number;
  readonly distManifestSha256: string;
  readonly endpointPaths: readonly string[];
  readonly endpointPathsSha256: string;
}

const walkFiles = async (directory: string): Promise<string[]> => {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walkFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
};
export const createLegacyDistManifest = async (distDirectory: string): Promise<LegacyDistManifest> => {
  const paths = (await walkFiles(distDirectory))
    .map((path) => ({ absolute: path, relative: relative(distDirectory, path).replaceAll("\\", "/") }))
    .sort((left, right) => compareCanonicalKeys(left.relative, right.relative));
  const files: LegacyDistManifestEntry[] = [];
  for (const path of paths) {
    const [bytes, metadata] = await Promise.all([readFile(path.absolute), stat(path.absolute)]);
    files.push({ path: path.relative, sizeBytes: metadata.size, sha256: sha256(bytes) });
  }
  const endpointPaths = files
    .map((item) => normalizeBuiltFileToEndpoint(item.path))
    .filter((item): item is string => item !== undefined)
    .sort(compareCanonicalKeys);
  return {
    schemaVersion: 1,
    files,
    fileCount: files.length,
    distManifestSha256: fingerprint(files),
    endpointPaths,
    endpointPathsSha256: fingerprint(endpointPaths),
  };
};

export interface LegacyDistDifference {
  readonly path: string;
  readonly first?: Readonly<{ sizeBytes: number; sha256: string }>;
  readonly second?: Readonly<{ sizeBytes: number; sha256: string }>;
}

export const compareLegacyDistManifests = (
  first: LegacyDistManifest,
  second: LegacyDistManifest,
): readonly LegacyDistDifference[] => {
  const firstByPath = new Map(first.files.map((item) => [item.path, item]));
  const secondByPath = new Map(second.files.map((item) => [item.path, item]));
  const allPaths = new Set([...firstByPath.keys(), ...secondByPath.keys()]);
  const differences: LegacyDistDifference[] = [];
  for (const path of [...allPaths].sort(compareCanonicalKeys)) {
    const left = firstByPath.get(path);
    const right = secondByPath.get(path);
    if (left?.sha256 === right?.sha256 && left?.sizeBytes === right?.sizeBytes) continue;
    differences.push({
      path,
      ...(left ? { first: { sizeBytes: left.sizeBytes, sha256: left.sha256 } } : {}),
      ...(right ? { second: { sizeBytes: right.sizeBytes, sha256: right.sha256 } } : {}),
    });
  }
  return differences;
};
