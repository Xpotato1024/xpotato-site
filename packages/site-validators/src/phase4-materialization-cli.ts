import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import * as contracts from "../../content-contracts/src/index.ts";

const ROOT = process.cwd();
const LEGACY_TAG = "legacy-pre-vnext-2026-08-28";
const MAP_PATH = resolve(ROOT, "docs/migration/content-id-map-v1.json");
const CANDIDATE_PATH = resolve(ROOT, "docs/migration/content-candidate-baseline-v1.json");
const REPORT_PATH = resolve(ROOT, "docs/migration/content-materialization-report-v1.json");
const WRITE = process.argv.includes("--write");

type PlainObject = Record<string, unknown>;
type ZodLike = { safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: { issues?: unknown[] } } };

interface MapEntry {
  readonly legacyContentId: string;
  readonly legacyPath: string;
  readonly collection: string;
  readonly targetPath: string;
  readonly vNextContentId: string;
  readonly disposition: string;
}

interface ContentMap extends PlainObject {
  readonly allocationVersion: string;
  readonly source: PlainObject;
  readonly entries: readonly MapEntry[];
  readonly mappingPayloadSha256: string;
}

const isObject = (value: unknown): value is PlainObject => value !== null && typeof value === "object" && !Array.isArray(value);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const compareUtf16 = (left: string, right: string): number => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = left.charCodeAt(index) - right.charCodeAt(index);
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort(compareUtf16).map((key) => [key, canonicalize(value[key])]));
};
const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value));
const canonicalSha256 = (value: unknown): string => sha256(canonicalJson(value));

const gitShow = (path: string): string => execFileSync("git", ["show", `${LEGACY_TAG}:${path}`], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const collectObjects = (value: unknown, path = "$", output: Array<{ path: string; value: PlainObject }> = []): Array<{ path: string; value: PlainObject }> => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectObjects(item, `${path}[${index}]`, output));
    return output;
  }
  if (!isObject(value)) return output;
  output.push({ path, value });
  Object.entries(value).forEach(([key, item]) => collectObjects(item, `${path}.${key}`, output));
  return output;
};

const findSchemaMap = (): Record<string, ZodLike> => {
  for (const value of Object.values(contracts)) {
    if (!isObject(value)) continue;
    if (["blog", "notes", "projects", "tools"].every((key) => isObject(value[key]) && typeof (value[key] as ZodLike).safeParse === "function")) {
      return value as Record<string, ZodLike>;
    }
  }
  throw new Error("Unable to locate exported content collection schemas");
};
const schemas = findSchemaMap();

const splitFrontmatter = (source: string): { frontmatter: PlainObject; body: string } => {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: {}, body: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Unterminated legacy frontmatter");
  const parsed = parseYaml(normalized.slice(4, end));
  if (!isObject(parsed)) throw new Error("Legacy frontmatter must be an object");
  return { frontmatter: parsed, body: normalized.slice(end + 5) };
};

const candidateIndex = (manifest: unknown): Map<string, PlainObject> => {
  const selected = new Map<string, { score: number; path: string; value: PlainObject }>();
  for (const item of collectObjects(manifest)) {
    if (typeof item.value.legacyContentId !== "string") continue;
    let score = Object.keys(item.value).length;
    if ("candidateFrontmatter" in item.value || "frontmatter" in item.value) score += 100;
    if ("candidateBody" in item.value || "portableMdx" in item.value || "body" in item.value) score += 50;
    const previous = selected.get(item.value.legacyContentId);
    if (!previous || score > previous.score || (score === previous.score && compareUtf16(item.path, previous.path) < 0)) {
      selected.set(item.value.legacyContentId, { score, path: item.path, value: item.value });
    }
  }
  return new Map([...selected].map(([key, wrapped]) => [key, wrapped.value]));
};

const metadataKeys = new Set([
  "legacyContentId", "legacyPath", "targetPath", "collection", "disposition",
  "body", "mdx", "candidateBody", "portableMdx", "mdxBody",
  "bodySha256", "frontmatterSha256", "candidateSha256", "sourceSha256",
  "blockers", "warnings", "status", "source", "target",
]);

const sanitizeObject = (input: PlainObject, id: string): PlainObject => {
  const output: PlainObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (metadataKeys.has(key)) continue;
    output[key === "contentId" ? "id" : key] = value;
  }
  output.id = id;
  return output;
};

const frontmatterAttempts = (candidate: PlainObject, legacy: PlainObject, id: string): Array<{ label: string; value: PlainObject }> => {
  const nested = collectObjects(candidate)
    .map(({ path, value }) => {
      let score = 0;
      if (/candidateFrontmatter|targetFrontmatter|vNextFrontmatter/iu.test(path)) score += 200;
      if (/frontmatter/iu.test(path)) score += 100;
      if (typeof value.title === "string") score += 30;
      if (typeof value.description === "string" || typeof value.summary === "string") score += 12;
      if ("draft" in value) score += 8;
      if ("tags" in value) score += 8;
      if ("publishedAt" in value || "pubDate" in value || "date" in value) score += 8;
      if ("legacyPath" in value || "targetPath" in value) score -= 20;
      return { label: path, value: sanitizeObject(value, id), score };
    })
    .sort((left, right) => right.score - left.score || compareUtf16(left.label, right.label));

  const common: PlainObject = {
    id,
    title: legacy.title,
    description: legacy.description ?? legacy.summary ?? legacy.excerpt ?? legacy.title,
    draft: legacy.draft ?? false,
  };
  const publishedAt = legacy.publishedAt ?? legacy.pubDate ?? legacy.date;
  const updatedAt = legacy.updatedAt ?? legacy.updatedDate ?? legacy.lastmod;
  if (publishedAt !== undefined) common.publishedAt = publishedAt;
  if (updatedAt !== undefined) common.updatedAt = updatedAt;
  if (legacy.tags !== undefined) common.tags = legacy.tags;
  if (legacy.seo !== undefined) common.seo = legacy.seo;

  return [
    ...nested.map(({ label, value }) => ({ label, value })),
    { label: "legacy-exact", value: { ...legacy, id } },
    { label: "legacy-common", value: common },
    { label: "legacy-common-summary", value: { ...common, summary: legacy.summary ?? legacy.description ?? legacy.excerpt ?? legacy.title } },
  ];
};

const parseFrontmatterCandidate = (schema: ZodLike, candidate: PlainObject, legacy: PlainObject, id: string, legacyContentId: string): PlainObject => {
  const failures: Array<{ label: string; issues: unknown[] }> = [];
  for (const attempt of frontmatterAttempts(candidate, legacy, id)) {
    const parsed = schema.safeParse(attempt.value);
    if (parsed.success && isObject(parsed.data)) return parsed.data;
    failures.push({ label: attempt.label, issues: parsed.error?.issues?.slice(0, 4) ?? [] });
  }
  throw new Error(`No frontmatter candidate passes schema for ${legacyContentId}: ${JSON.stringify(failures.slice(0, 8))}`);
};

const findNamedString = (value: unknown, names: readonly string[]): string | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNamedString(item, names);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  for (const name of names) {
    const raw = value[name];
    if (typeof raw === "string" && raw.length > 0 && !/^[a-f0-9]{64}$/u.test(raw)) return raw;
  }
  for (const key of Object.keys(value).sort(compareUtf16)) {
    const found = findNamedString(value[key], names);
    if (found !== undefined) return found;
  }
  return undefined;
};

const portableTransform = (source: string): string => {
  let body = source.replace(/\r\n?/gu, "\n");
  body = body.replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gmu, "");
  body = body.replace(/^\s*import\s*["'][^"']+["'];?\s*$/gmu, "");
  body = body.replace(/^\s*export\s+[^\n]*$/gmu, "");
  body = body.replace(/<PrimeFactorizer(?:\s[^>]*)?\s*\/>/gu, '<Demo module="prime-factorizer" />');
  body = body.replace(/<PrimeFactorizer(?:\s[^>]*)?>[\s\S]*?<\/PrimeFactorizer>/gu, '<Demo module="prime-factorizer" />');
  body = body.replace(/\n{3,}/gu, "\n\n").trimStart();
  return body.endsWith("\n") ? body : `${body}\n`;
};

const serialize = (frontmatter: PlainObject, body: string): string => `---\n${stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${body}`;

const mapText = readFileSync(MAP_PATH, "utf8");
const candidateText = readFileSync(CANDIDATE_PATH, "utf8");
const map = JSON.parse(mapText) as ContentMap;
const candidateManifest = JSON.parse(candidateText) as PlainObject;
if (!Array.isArray(map.entries)) throw new Error("Content map entries missing");
const candidates = candidateIndex(candidateManifest);
const reportEntries: PlainObject[] = [];
const expectedFiles = new Map<string, string>();
const seenTargets = new Set<string>();

for (const entry of [...map.entries].sort((left, right) => compareUtf16(left.legacyContentId, right.legacyContentId))) {
  if (seenTargets.has(entry.targetPath)) throw new Error(`Duplicate target path: ${entry.targetPath}`);
  seenTargets.add(entry.targetPath);
  const candidate = candidates.get(entry.legacyContentId);
  if (!candidate) throw new Error(`Candidate missing for ${entry.legacyContentId}`);
  const candidateEntrySha256 = canonicalSha256(candidate);

  if (entry.disposition !== "migrate") {
    reportEntries.push({
      legacyContentId: entry.legacyContentId,
      targetPath: entry.targetPath,
      vNextContentId: entry.vNextContentId,
      status: "bound_existing",
      disposition: entry.disposition,
      candidateEntrySha256,
    });
    continue;
  }

  if (![".md", ".mdx"].includes(extname(entry.targetPath))) throw new Error(`Unsupported target extension: ${entry.targetPath}`);
  const schema = schemas[entry.collection];
  if (!schema) throw new Error(`Collection schema missing: ${entry.collection}`);
  const legacySource = gitShow(entry.legacyPath);
  const legacy = splitFrontmatter(legacySource);
  const frontmatter = parseFrontmatterCandidate(schema, candidate, legacy.frontmatter, entry.vNextContentId, entry.legacyContentId);
  const candidateBody = findNamedString(candidate, ["candidateBody", "portableMdx", "mdxBody", "body", "mdx"]);
  const body = portableTransform(candidateBody ?? legacy.body);
  const materialized = serialize(frontmatter, body);
  expectedFiles.set(entry.targetPath, materialized);
  reportEntries.push({
    legacyContentId: entry.legacyContentId,
    legacyPath: entry.legacyPath,
    targetPath: entry.targetPath,
    vNextContentId: entry.vNextContentId,
    status: "materialized",
    bodySource: candidateBody === undefined ? "frozen_legacy" : "candidate",
    legacySourceSha256: sha256(legacySource),
    candidateEntrySha256,
    frontmatterSha256: canonicalSha256(frontmatter),
    bodySha256: sha256(body),
    materializedSha256: sha256(materialized),
  });
}

const unsignedReport: PlainObject = {
  schemaVersion: 2,
  materializerVersion: "phase4-materialize-v3",
  source: map.source,
  allocationVersion: map.allocationVersion,
  mappingPayloadSha256: map.mappingPayloadSha256,
  mapFileSha256: sha256(mapText),
  candidateFileSha256: sha256(candidateText),
  candidatePayloadSha256: candidateManifest.candidatePayloadSha256 ?? candidateManifest.manifestPayloadSha256 ?? null,
  entries: reportEntries,
};
const expectedReport = { ...unsignedReport, payloadSha256: canonicalSha256(unsignedReport) };
const expectedReportText = `${JSON.stringify(expectedReport, null, 2)}\n`;

if (WRITE) {
  for (const [path, content] of expectedFiles) {
    const absolute = resolve(ROOT, path);
    const relativePath = relative(ROOT, absolute);
    if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) throw new Error(`Target escapes repository root: ${path}`);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
  }
  writeFileSync(REPORT_PATH, expectedReportText, "utf8");
  console.log(`Phase 4 materialization WRITE PASS: ${expectedFiles.size} files`);
  process.exit(0);
}

const failures: string[] = [];
for (const [path, expected] of expectedFiles) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) {
    failures.push(`${path}: missing`);
    continue;
  }
  const actual = readFileSync(absolute, "utf8");
  if (actual !== expected) failures.push(`${path}: does not reproduce from frozen source and candidate manifest`);
}
if (!existsSync(REPORT_PATH)) failures.push("Materialization report missing");
else if (readFileSync(REPORT_PATH, "utf8") !== expectedReportText) failures.push("Materialization report does not reproduce exactly");

const forbiddenHelpers = [
  ".github/workflows/phase4-allocation-temporary.yml",
  ".github/workflows/phase4-materialize-temporary.yml",
  ".github/workflows/phase4-materialize-v2-temporary.yml",
  ".github/workflows/phase4-finalize-temporary.yml",
  ".github/workflows/phase4-machine-gate-temporary.yml",
  ".github/workflows/phase4-readiness-evidence-temporary.yml",
  "scripts/phase4_allocator_fix_temp.py",
  "scripts/phase4_materialize_content_temp.mjs",
  "scripts/phase4_materialize_content_v2_temp.ts",
];
for (const path of forbiddenHelpers) if (existsSync(resolve(ROOT, path))) failures.push(`One-time helper remains: ${path}`);

if (failures.length > 0) throw new Error(`Phase 4 reproducible materialization failed:\n${failures.join("\n")}`);
console.log(`Phase 4 reproducible materialization PASS: ${expectedFiles.size} files`);
