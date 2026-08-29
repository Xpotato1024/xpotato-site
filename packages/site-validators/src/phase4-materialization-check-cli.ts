import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const mapPath = resolve(root, "docs/migration/content-id-map-v1.json");
const reportPath = resolve(root, "docs/migration/content-materialization-report-v1.json");

interface MapEntry {
  readonly legacyContentId: string;
  readonly legacyPath: string;
  readonly collection: string;
  readonly targetPath: string;
  readonly vNextContentId: string;
  readonly disposition: string;
}

interface ContentMap {
  readonly entries: readonly MapEntry[];
  readonly mappingPayloadSha256: string;
}

interface ReportEntry {
  readonly legacyContentId: string;
  readonly targetPath: string;
  readonly vNextContentId?: string;
  readonly status: string;
  readonly materializedSha256?: string;
}

interface MaterializationReport {
  readonly schemaVersion: number;
  readonly materializerVersion: string;
  readonly mappingPayloadSha256: string;
  readonly entries: readonly ReportEntry[];
  readonly payloadSha256: string;
}

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const fail = (message: string): never => { throw new Error(message); };

const parseFrontmatter = (source: string, path: string): Record<string, unknown> => {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) fail(`${path}: frontmatter opening delimiter missing`);
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) fail(`${path}: frontmatter closing delimiter missing`);
  const parsed = parseYaml(normalized.slice(4, end));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) fail(`${path}: frontmatter must be an object`);
  return parsed as Record<string, unknown>;
};

const map = readJson<ContentMap>(mapPath);
const report = readJson<MaterializationReport>(reportPath);
const failures: string[] = [];

if (!Array.isArray(map.entries) || map.entries.length === 0) failures.push("Content identity map has no entries");
if (!Array.isArray(report.entries)) failures.push("Materialization report entries missing");
if (report.mappingPayloadSha256 !== map.mappingPayloadSha256) failures.push("Report mapping payload does not match ContentId map");

const reportUnsigned = { ...report } as Record<string, unknown>;
delete reportUnsigned.payloadSha256;
if (sha256(JSON.stringify(reportUnsigned)) !== report.payloadSha256) failures.push("Materialization report payload SHA mismatch");

const reportByLegacyId = new Map<string, ReportEntry>();
for (const entry of report.entries ?? []) {
  if (reportByLegacyId.has(entry.legacyContentId)) failures.push(`Duplicate report LegacyContentId: ${entry.legacyContentId}`);
  reportByLegacyId.set(entry.legacyContentId, entry);
}

const seenLegacyIds = new Set<string>();
const seenContentIds = new Set<string>();
const seenTargets = new Set<string>();
let materializedCount = 0;
let boundExistingCount = 0;

for (const entry of map.entries ?? []) {
  if (seenLegacyIds.has(entry.legacyContentId)) failures.push(`Duplicate map LegacyContentId: ${entry.legacyContentId}`);
  seenLegacyIds.add(entry.legacyContentId);
  if (seenContentIds.has(entry.vNextContentId)) failures.push(`Duplicate vNext ContentId: ${entry.vNextContentId}`);
  seenContentIds.add(entry.vNextContentId);
  if (seenTargets.has(entry.targetPath)) failures.push(`Duplicate targetPath: ${entry.targetPath}`);
  seenTargets.add(entry.targetPath);

  const observed = reportByLegacyId.get(entry.legacyContentId);
  if (!observed) {
    failures.push(`${entry.legacyContentId}: report entry missing`);
    continue;
  }
  if (observed.targetPath !== entry.targetPath) failures.push(`${entry.legacyContentId}: report targetPath mismatch`);

  if (entry.disposition !== "migrate") {
    boundExistingCount += 1;
    if (observed.status !== "bound_existing") failures.push(`${entry.legacyContentId}: expected bound_existing status`);
    continue;
  }

  materializedCount += 1;
  if (observed.status !== "materialized") failures.push(`${entry.legacyContentId}: expected materialized status`);
  if (observed.vNextContentId !== entry.vNextContentId) failures.push(`${entry.legacyContentId}: report ContentId mismatch`);
  if (![".md", ".mdx"].includes(extname(entry.targetPath))) failures.push(`${entry.legacyContentId}: unsupported target extension`);
  const absolute = resolve(root, entry.targetPath);
  const relativePath = relative(root, absolute);
  if (relativePath.startsWith(`..${sep}`) || relativePath === "..") failures.push(`${entry.legacyContentId}: target escapes repository root`);
  if (!existsSync(absolute)) {
    failures.push(`${entry.legacyContentId}: target file missing: ${entry.targetPath}`);
    continue;
  }
  const source = readFileSync(absolute, "utf8");
  if (sha256(source) !== observed.materializedSha256) failures.push(`${entry.legacyContentId}: materialized file SHA mismatch`);
  try {
    const frontmatter = parseFrontmatter(source, entry.targetPath);
    if (frontmatter.id !== entry.vNextContentId) failures.push(`${entry.legacyContentId}: frontmatter id mismatch`);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (reportByLegacyId.size !== seenLegacyIds.size) failures.push(`Report/map entry count mismatch: ${reportByLegacyId.size} != ${seenLegacyIds.size}`);

const forbiddenHelpers = [
  ".github/workflows/phase4-allocation-temporary.yml",
  ".github/workflows/phase4-materialize-temporary.yml",
  ".github/workflows/phase4-materialize-v2-temporary.yml",
  ".github/workflows/phase4-finalize-temporary.yml",
  "scripts/phase4_allocator_fix_temp.py",
  "scripts/phase4_materialize_content_temp.mjs",
  "scripts/phase4_materialize_content_v2_temp.ts",
];
for (const path of forbiddenHelpers) if (existsSync(resolve(root, path))) failures.push(`One-time helper remains: ${path}`);

if (failures.length > 0) {
  throw new Error(`Phase 4 materialization validation failed:\n${failures.join("\n")}`);
}

console.log(`Phase 4 materialization PASS: ${materializedCount} materialized, ${boundExistingCount} bound existing`);
