import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const ROOT = process.cwd();
const LEGACY_TAG = "legacy-pre-vnext-2026-08-28";
const MAP_PATH = resolve(ROOT, "docs/migration/content-id-map-v1.json");
const CANDIDATE_PATH = resolve(ROOT, "docs/migration/content-candidate-baseline-v1.json");
const REPORT_PATH = resolve(ROOT, "docs/migration/content-materialization-report-v1.json");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const canonicalCompare = (a, b) => {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const delta = a.charCodeAt(i) - b.charCodeAt(i);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
};

const gitShow = (path) => execFileSync("git", ["show", `${LEGACY_TAG}:${path}`], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const stripFrontmatter = (source) => {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Unterminated frontmatter");
  return normalized.slice(end + 5);
};

const collectObjects = (value, path = "$", output = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectObjects(item, `${path}[${index}]`, output));
    return output;
  }
  if (!isObject(value)) return output;
  output.push({ path, value });
  for (const [key, item] of Object.entries(value)) collectObjects(item, `${path}.${key}`, output);
  return output;
};

const candidateByLegacyId = (manifest) => {
  const result = new Map();
  for (const { value } of collectObjects(manifest)) {
    if (typeof value.legacyContentId === "string") {
      const existing = result.get(value.legacyContentId);
      const score = Object.keys(value).length;
      if (!existing || score > existing.score) result.set(value.legacyContentId, { score, value });
    }
  }
  return new Map([...result].map(([id, wrapped]) => [id, wrapped.value]));
};

const exactNested = (entry, names) => {
  for (const { path, value } of collectObjects(entry)) {
    const final = path.split(".").at(-1) ?? "";
    if (names.includes(final) && isObject(value)) return value;
  }
  return undefined;
};

const selectFrontmatter = (candidate, mapEntry) => {
  const preferred = exactNested(candidate, [
    "candidateFrontmatter",
    "targetFrontmatter",
    "vNextFrontmatter",
    "frontmatter",
  ]);
  const objects = collectObjects(candidate)
    .map(({ path, value }) => {
      let score = 0;
      if (typeof value.title === "string") score += 30;
      if (typeof value.description === "string" || typeof value.summary === "string") score += 12;
      if (typeof value.id === "string" || typeof value.contentId === "string") score += 12;
      if ("draft" in value) score += 6;
      if ("tags" in value) score += 6;
      if ("publishedAt" in value || "pubDate" in value || "date" in value) score += 6;
      if (/frontmatter|candidate/iu.test(path)) score += 8;
      if ("legacyPath" in value || "targetPath" in value || "bodySha256" in value) score -= 10;
      return { path, value, score };
    })
    .sort((a, b) => b.score - a.score || canonicalCompare(a.path, b.path));
  const selected = preferred ?? objects.find((item) => item.score >= 30)?.value;
  if (!selected) throw new Error(`No candidate frontmatter object for ${mapEntry.legacyContentId}`);
  const output = structuredClone(selected);
  delete output.legacyContentId;
  delete output.legacyPath;
  delete output.targetPath;
  delete output.collection;
  delete output.disposition;
  delete output.body;
  delete output.mdx;
  delete output.bodySha256;
  delete output.frontmatterSha256;
  output.id = mapEntry.vNextContentId;
  if ("contentId" in output) {
    output.id = output.contentId;
    delete output.contentId;
  }
  return output;
};

const selectCandidateBody = (candidate) => {
  const preferredNames = ["candidateBody", "portableMdx", "mdxBody", "body", "mdx"];
  for (const { path, value } of collectObjects(candidate)) {
    const final = path.split(".").at(-1) ?? "";
    if (preferredNames.includes(final) && typeof value === "string" && !/^[a-f0-9]{64}$/u.test(value)) {
      return value.replace(/\r\n?/gu, "\n");
    }
  }
  return undefined;
};

const removeImports = (body) => body
  .replace(/^\s*import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*$/gmu, "")
  .replace(/^\s*import\s*["'][^"']+["'];?\s*$/gmu, "")
  .replace(/^\s*export\s+[^\n]*$/gmu, "");

const transformKnownPortableMdx = (input) => {
  let body = input;
  body = removeImports(body);
  body = body.replace(/<PrimeFactorizer(?:\s[^>]*)?\s*\/>/gu, '<Demo module="prime-factorizer" />');
  body = body.replace(/<PrimeFactorizer(?:\s[^>]*)?>[\s\S]*?<\/PrimeFactorizer>/gu, '<Demo module="prime-factorizer" />');
  body = body.replace(/\n{3,}/gu, "\n\n").trimStart();
  return body.endsWith("\n") ? body : `${body}\n`;
};

const serializeFrontmatter = (frontmatter) => `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n`;

const contentMap = readJson(MAP_PATH);
const candidateManifest = readJson(CANDIDATE_PATH);
if (!Array.isArray(contentMap.entries)) throw new Error("Content identity map entries missing");
const candidates = candidateByLegacyId(candidateManifest);
const reportEntries = [];
const seenTargetPaths = new Set();

for (const mapEntry of [...contentMap.entries].sort((a, b) => canonicalCompare(a.legacyContentId, b.legacyContentId))) {
  if (mapEntry.disposition !== "migrate") {
    reportEntries.push({
      legacyContentId: mapEntry.legacyContentId,
      targetPath: mapEntry.targetPath,
      status: "bound_existing",
      disposition: mapEntry.disposition,
    });
    continue;
  }
  if (seenTargetPaths.has(mapEntry.targetPath)) throw new Error(`Duplicate target path: ${mapEntry.targetPath}`);
  seenTargetPaths.add(mapEntry.targetPath);
  const candidate = candidates.get(mapEntry.legacyContentId);
  if (!candidate) throw new Error(`Candidate missing for ${mapEntry.legacyContentId}`);
  const nestedBlockers = collectObjects(candidate)
    .flatMap(({ path, value }) => Object.entries(value)
      .filter(([key, item]) => /blocker|error/iu.test(key) && ((Array.isArray(item) && item.length > 0) || (typeof item === "string" && item.trim() !== "")))
      .map(([key, item]) => ({ path: `${path}.${key}`, value: item })));
  if (nestedBlockers.length > 0) {
    throw new Error(`Candidate blockers remain for ${mapEntry.legacyContentId}: ${JSON.stringify(nestedBlockers)}`);
  }
  const extension = extname(mapEntry.targetPath);
  if (extension !== ".md" && extension !== ".mdx") {
    throw new Error(`Migrated target must be Markdown/MDX: ${mapEntry.targetPath}`);
  }
  const frontmatter = selectFrontmatter(candidate, mapEntry);
  const legacySource = gitShow(mapEntry.legacyPath);
  const candidateBody = selectCandidateBody(candidate);
  const body = transformKnownPortableMdx(candidateBody ?? stripFrontmatter(legacySource));
  const materialized = `${serializeFrontmatter(frontmatter)}${body}`;
  const targetAbsolute = resolve(ROOT, mapEntry.targetPath);
  mkdirSync(dirname(targetAbsolute), { recursive: true });
  writeFileSync(targetAbsolute, materialized, "utf8");
  reportEntries.push({
    legacyContentId: mapEntry.legacyContentId,
    targetPath: mapEntry.targetPath,
    vNextContentId: mapEntry.vNextContentId,
    status: "materialized",
    sourceBody: candidateBody ? "candidate" : "frozen_legacy",
    materializedSha256: sha256(materialized),
  });
}

const reportPayload = {
  schemaVersion: 1,
  materializerVersion: "phase4-materialize-v1",
  source: contentMap.source,
  allocationVersion: contentMap.allocationVersion,
  mappingPayloadSha256: contentMap.mappingPayloadSha256,
  candidatePayloadSha256: candidateManifest.candidatePayloadSha256 ?? candidateManifest.manifestPayloadSha256 ?? null,
  entries: reportEntries,
};
const payloadSha256 = sha256(JSON.stringify(reportPayload));
writeFileSync(REPORT_PATH, `${JSON.stringify({ ...reportPayload, payloadSha256 }, null, 2)}\n`, "utf8");
console.log(`Phase 4 materialization wrote ${reportEntries.filter((entry) => entry.status === "materialized").length} content files`);
