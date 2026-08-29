import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import * as contracts from "../packages/content-contracts/src/index.ts";

const ROOT = process.cwd();
const LEGACY_TAG = "legacy-pre-vnext-2026-08-28";
const MAP_PATH = resolve(ROOT, "docs/migration/content-id-map-v1.json");
const CANDIDATE_PATH = resolve(ROOT, "docs/migration/content-candidate-baseline-v1.json");
const REPORT_PATH = resolve(ROOT, "docs/migration/content-materialization-report-v1.json");
const COLLECTIONS = ["blog", "notes", "projects", "tools", "pages"] as const;

type PlainObject = Record<string, unknown>;
type ZodLike = { safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: { issues?: unknown[] } } };

const isObject = (value: unknown): value is PlainObject => value !== null && typeof value === "object" && !Array.isArray(value);
const readJson = (path: string): PlainObject => JSON.parse(readFileSync(path, "utf8")) as PlainObject;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const compareUtf16 = (a: string, b: string): number => {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = a.charCodeAt(index) - b.charCodeAt(index);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
};
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
    const keys = ["blog", "notes", "projects", "tools"];
    if (keys.every((key) => isObject(value[key]) && typeof (value[key] as ZodLike).safeParse === "function")) {
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
  if (!isObject(parsed)) throw new Error("Legacy frontmatter is not an object");
  return { frontmatter: parsed, body: normalized.slice(end + 5) };
};

const candidateIndex = (manifest: unknown): Map<string, PlainObject> => {
  const selected = new Map<string, { score: number; value: PlainObject }>();
  for (const { value } of collectObjects(manifest)) {
    if (typeof value.legacyContentId !== "string") continue;
    let score = Object.keys(value).length;
    if ("candidateFrontmatter" in value || "frontmatter" in value) score += 100;
    if ("candidateBody" in value || "portableMdx" in value || "body" in value) score += 50;
    const previous = selected.get(value.legacyContentId);
    if (!previous || score > previous.score) selected.set(value.legacyContentId, { score, value });
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
  const result: PlainObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (metadataKeys.has(key)) continue;
    result[key === "contentId" ? "id" : key] = value;
  }
  result.id = id;
  return result;
};

const candidateObjects = (entry: PlainObject, id: string): Array<{ path: string; value: PlainObject; score: number }> => collectObjects(entry)
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
    return { path, value: sanitizeObject(value, id), score };
  })
  .sort((left, right) => right.score - left.score || compareUtf16(left.path, right.path));

const legacyDerivedCandidates = (legacy: PlainObject, id: string): PlainObject[] => {
  const common: PlainObject = {
    id,
    title: legacy.title,
    description: legacy.description ?? legacy.summary ?? legacy.excerpt ?? legacy.title,
    draft: legacy.draft ?? false,
  };
  const publishedAt = legacy.publishedAt ?? legacy.pubDate ?? legacy.date;
  if (publishedAt !== undefined) common.publishedAt = publishedAt;
  const updatedAt = legacy.updatedAt ?? legacy.updatedDate ?? legacy.lastmod;
  if (updatedAt !== undefined) common.updatedAt = updatedAt;
  if (legacy.tags !== undefined) common.tags = legacy.tags;
  if (legacy.seo !== undefined) common.seo = legacy.seo;
  return [
    { ...legacy, id },
    common,
    { ...common, summary: legacy.summary ?? legacy.description ?? legacy.excerpt ?? legacy.title },
  ];
};

const selectParsedFrontmatter = (schema: ZodLike, candidate: PlainObject, legacy: PlainObject, id: string, legacyContentId: string): PlainObject => {
  const attempts = [
    ...candidateObjects(candidate, id).map((item) => ({ label: item.path, value: item.value })),
    ...legacyDerivedCandidates(legacy, id).map((value, index) => ({ label: `legacy-derived-${index}`, value })),
  ];
  const failures: Array<{ label: string; issues: unknown[] }> = [];
  for (const attempt of attempts) {
    const parsed = schema.safeParse(attempt.value);
    if (parsed.success && isObject(parsed.data)) return parsed.data;
    failures.push({ label: attempt.label, issues: parsed.error?.issues?.slice(0, 4) ?? [] });
  }
  throw new Error(`No frontmatter candidate passes schema for ${legacyContentId}: ${JSON.stringify(failures.slice(0, 8))}`);
};

const findBody = (candidate: PlainObject): string | undefined => {
  const preferred = ["candidateBody", "portableMdx", "mdxBody", "body", "mdx"];
  for (const name of preferred) {
    for (const { path, value } of collectObjects(candidate)) {
      const final = path.split(".").at(-1);
      const raw = value[name];
      if (final === name && typeof value === "object") continue;
      if (typeof raw === "string" && raw.length > 0 && !/^[a-f0-9]{64}$/u.test(raw)) return raw;
    }
  }
  for (const { path, value } of collectObjects(candidate)) {
    for (const [key, raw] of Object.entries(value)) {
      if (/^(candidateBody|portableMdx|mdxBody|body|mdx)$/u.test(key) && typeof raw === "string" && !/^[a-f0-9]{64}$/u.test(raw)) {
        return raw;
      }
    }
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

const map = readJson(MAP_PATH);
const manifest = readJson(CANDIDATE_PATH);
if (!Array.isArray(map.entries)) throw new Error("Content map entries missing");
const candidates = candidateIndex(manifest);
const reportEntries: PlainObject[] = [];
const targetPaths = new Set<string>();

for (const rawEntry of [...map.entries].sort((left, right) => compareUtf16(String((left as PlainObject).legacyContentId), String((right as PlainObject).legacyContentId)))) {
  if (!isObject(rawEntry)) throw new Error("Invalid content map entry");
  const legacyContentId = String(rawEntry.legacyContentId);
  const targetPath = String(rawEntry.targetPath);
  const disposition = String(rawEntry.disposition);
  if (disposition !== "migrate") {
    reportEntries.push({ legacyContentId, targetPath, disposition, status: "bound_existing" });
    continue;
  }
  if (targetPaths.has(targetPath)) throw new Error(`Duplicate target path: ${targetPath}`);
  targetPaths.add(targetPath);
  if (![".md", ".mdx"].includes(extname(targetPath))) throw new Error(`Unsupported migrated target: ${targetPath}`);
  const collection = String(rawEntry.collection);
  const schema = schemas[collection];
  if (!schema) throw new Error(`No collection schema for ${collection}`);
  const candidate = candidates.get(legacyContentId);
  if (!candidate) throw new Error(`Missing candidate: ${legacyContentId}`);
  const legacySource = gitShow(String(rawEntry.legacyPath));
  const legacy = splitFrontmatter(legacySource);
  const frontmatter = selectParsedFrontmatter(schema, candidate, legacy.frontmatter, String(rawEntry.vNextContentId), legacyContentId);
  const body = portableTransform(findBody(candidate) ?? legacy.body);
  const materialized = serialize(frontmatter, body);
  const absolute = resolve(ROOT, targetPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, materialized, "utf8");
  reportEntries.push({
    legacyContentId,
    targetPath,
    vNextContentId: rawEntry.vNextContentId,
    status: "materialized",
    bodySource: findBody(candidate) ? "candidate" : "frozen_legacy",
    materializedSha256: sha256(materialized),
  });
}

const report: PlainObject = {
  schemaVersion: 1,
  materializerVersion: "phase4-materialize-v2",
  source: map.source,
  allocationVersion: map.allocationVersion,
  mappingPayloadSha256: map.mappingPayloadSha256,
  entries: reportEntries,
};
report.payloadSha256 = sha256(JSON.stringify(report));
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Phase 4 schema-driven materialization PASS: ${reportEntries.filter((item) => item.status === "materialized").length} files`);
