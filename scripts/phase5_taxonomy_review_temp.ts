import { readFileSync, writeFileSync } from "node:fs";
import {
  phase5TaxonomyRawInventorySchema,
  phase5TaxonomyReviewManifestSchema,
  type Phase5TaxonomyReviewDecision,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";

const raw = phase5TaxonomyRawInventorySchema.parse(JSON.parse(readFileSync("docs/migration/taxonomy-raw-inventory-v1.json", "utf8")));

type Kind = "technology" | "topic";
interface TagSpec { readonly label: string; readonly kind: Kind }

const tagSpecs: Readonly<Record<string, TagSpec>> = {
  ai: { label: "AI", kind: "topic" },
  analysis: { label: "Analysis", kind: "topic" },
  anythingllm: { label: "AnythingLLM", kind: "technology" },
  astro: { label: "Astro", kind: "technology" },
  benchmark: { label: "Benchmark", kind: "topic" },
  "ci-cd": { label: "CI/CD", kind: "topic" },
  cli: { label: "CLI", kind: "topic" },
  codex: { label: "Codex", kind: "technology" },
  "conoha-vps": { label: "ConoHa VPS", kind: "technology" },
  cpu: { label: "CPU", kind: "technology" },
  debugging: { label: "Debugging", kind: "topic" },
  docker: { label: "Docker", kind: "technology" },
  firebase: { label: "Firebase", kind: "technology" },
  firestore: { label: "Firestore", kind: "technology" },
  gale: { label: "GALE", kind: "technology" },
  "github-actions": { label: "GitHub Actions", kind: "technology" },
  go: { label: "Go", kind: "technology" },
  gpu: { label: "GPU", kind: "technology" },
  homebrew: { label: "Homebrew", kind: "technology" },
  homelab: { label: "Home Lab", kind: "topic" },
  latex: { label: "LaTeX", kind: "technology" },
  lualatex: { label: "LuaLaTeX", kind: "technology" },
  math: { label: "Math", kind: "topic" },
  matplotlib: { label: "Matplotlib", kind: "technology" },
  mdx: { label: "MDX", kind: "technology" },
  migration: { label: "Migration", kind: "topic" },
  network: { label: "ネットワーク", kind: "topic" },
  operations: { label: "Operations", kind: "topic" },
  pandas: { label: "pandas", kind: "technology" },
  pandoc: { label: "Pandoc", kind: "technology" },
  performance: { label: "Performance", kind: "topic" },
  planner: { label: "Planner", kind: "topic" },
  postgresql: { label: "PostgreSQL", kind: "technology" },
  powershell: { label: "PowerShell", kind: "technology" },
  prime: { label: "Prime", kind: "topic" },
  "public-key-auth": { label: "公開鍵認証", kind: "topic" },
  python: { label: "Python", kind: "technology" },
  qdrant: { label: "Qdrant", kind: "technology" },
  qwen: { label: "Qwen", kind: "technology" },
  rag: { label: "RAG", kind: "topic" },
  rayon: { label: "Rayon", kind: "technology" },
  react: { label: "React", kind: "technology" },
  regex: { label: "Regex", kind: "topic" },
  release: { label: "Release", kind: "topic" },
  rerank: { label: "Reranking", kind: "topic" },
  rust: { label: "Rust", kind: "technology" },
  scoop: { label: "Scoop", kind: "technology" },
  search: { label: "Search", kind: "topic" },
  security: { label: "Security", kind: "topic" },
  "self-hosted": { label: "Self-hosted", kind: "topic" },
  simd: { label: "SIMD", kind: "technology" },
  sqlite: { label: "SQLite", kind: "technology" },
  ssd: { label: "SSD", kind: "technology" },
  ssh: { label: "SSH", kind: "technology" },
  storage: { label: "Storage", kind: "topic" },
  "tailwind-css": { label: "Tailwind CSS", kind: "technology" },
  tei: { label: "Text Embeddings Inference (TEI)", kind: "technology" },
  telemetry: { label: "Telemetry", kind: "topic" },
  tkinter: { label: "Tkinter", kind: "technology" },
  troubleshooting: { label: "Troubleshooting", kind: "topic" },
  tuning: { label: "Tuning", kind: "topic" },
  typescript: { label: "TypeScript", kind: "technology" },
  vllm: { label: "vLLM", kind: "technology" },
  vps: { label: "VPS", kind: "technology" },
  "web-server": { label: "Webサーバー", kind: "topic" },
  wgpu: { label: "wgpu", kind: "technology" },
  windows: { label: "Windows", kind: "technology" },
  winget: { label: "WinGet", kind: "technology" },
  wordpress: { label: "WordPress", kind: "technology" },
  wsl: { label: "WSL", kind: "technology" },
};

const archiveTagIds = new Set([
  "anythingllm", "docker", "gale", "gpu", "homelab", "migration", "performance", "planner",
  "qdrant", "rag", "rust", "search", "self-hosted", "telemetry", "troubleshooting", "typescript",
  "vllm", "wgpu", "windows", "wsl",
]);

const retiredTagTerms = new Map<string, Readonly<{ rationale: "typo" | "one_off" | "redundant_metadata" }>>([
  ["programing", { rationale: "typo" }],
  ["univ", { rationale: "one_off" }],
  ["初心者向け", { rationale: "one_off" }],
  ["calculation", { rationale: "redundant_metadata" }],
]);

const normalizedTargetOverrides = new Map<string, string>([
  ["tailwind", "tailwind-css"],
  ["tailwind css", "tailwind-css"],
  ["wsl2", "wsl"],
  ["webサーバー", "web-server"],
  ["公開鍵認証", "public-key-auth"],
]);

const preferredRawByTarget = new Map<string, string>([
  ["anythingllm", "AnythingLLM"],
  ["astro", "Astro"],
  ["docker", "Docker"],
  ["firebase", "Firebase"],
  ["go", "Go"],
  ["mdx", "MDX"],
  ["pandoc", "Pandoc"],
  ["postgresql", "PostgreSQL"],
  ["powershell", "PowerShell"],
  ["python", "Python"],
  ["qdrant", "Qdrant"],
  ["rag", "RAG"],
  ["react", "React"],
  ["tailwind-css", "Tailwind CSS"],
  ["tei", "TEI"],
  ["typescript", "TypeScript"],
  ["vllm", "vLLM"],
  ["wsl", "WSL"],
  ["web-server", "webサーバー"],
  ["public-key-auth", "公開鍵認証"],
]);

const decisions: Phase5TaxonomyReviewDecision[] = [];
for (const term of raw.terms) {
  if (term.namespace === "blog_category") {
    const mapping = term.rawValue === "devlog"
      ? { targetId: "software", supplementalTagIds: [] as string[], rationale: "category_repartition" as const }
      : term.rawValue === "infra"
        ? { targetId: "infrastructure", supplementalTagIds: [] as string[], rationale: "semantic_merge" as const }
        : term.rawValue === "network"
          ? { targetId: "infrastructure", supplementalTagIds: ["network"], rationale: "category_repartition" as const }
          : term.rawValue === "diary"
            ? { targetId: "robotics", supplementalTagIds: [] as string[], rationale: "category_repartition" as const }
            : undefined;
    if (!mapping) throw new Error(`Unreviewed Blog category raw term: ${term.rawValue}`);
    decisions.push({ namespace: term.namespace, rawValue: term.rawValue, disposition: "merge", ...mapping });
    continue;
  }
  if (term.namespace === "note_subject") {
    if (term.rawValue !== "infrastructure") throw new Error(`Unreviewed Note subject raw term: ${term.rawValue}`);
    decisions.push({ namespace: term.namespace, rawValue: term.rawValue, disposition: "active", targetId: "infrastructure", supplementalTagIds: [], rationale: "canonical" });
    continue;
  }
  if (term.namespace === "tool_category") {
    if (term.rawValue !== "calculation") throw new Error(`Unreviewed Tool category raw term: ${term.rawValue}`);
    decisions.push({ namespace: term.namespace, rawValue: term.rawValue, disposition: "active", targetId: "calculation", supplementalTagIds: [], rationale: "canonical" });
    continue;
  }

  const retired = retiredTagTerms.get(term.normalizedValue);
  if (retired) {
    decisions.push({ namespace: "tag", rawValue: term.rawValue, disposition: "retire", supplementalTagIds: [], rationale: retired.rationale });
    continue;
  }
  const targetId = normalizedTargetOverrides.get(term.normalizedValue) ?? term.normalizedValue;
  if (!tagSpecs[targetId]) throw new Error(`Unreviewed tag normalized term: ${term.rawValue} -> ${term.normalizedValue}`);
  const preferredRaw = preferredRawByTarget.get(targetId) ?? term.rawValue;
  if (term.normalizedValue === "wsl2") {
    decisions.push({ namespace: "tag", rawValue: term.rawValue, disposition: "merge", targetId, supplementalTagIds: [], rationale: "semantic_merge" });
  } else if (term.rawValue === preferredRaw) {
    decisions.push({ namespace: "tag", rawValue: term.rawValue, disposition: "active", targetId, supplementalTagIds: [], rationale: "canonical" });
  } else {
    decisions.push({ namespace: "tag", rawValue: term.rawValue, disposition: "alias", targetId, supplementalTagIds: [], rationale: "spelling_variant" });
  }
}

decisions.sort((left, right) => compareCanonicalKeys(`${left.namespace}\0${left.rawValue}`, `${right.namespace}\0${right.rawValue}`));
const aliasesByTarget = new Map<string, Set<string>>();
for (const decision of decisions) {
  if (decision.namespace !== "tag" || !decision.targetId) continue;
  if (decision.disposition === "alias") {
    const aliases = aliasesByTarget.get(decision.targetId) ?? new Set<string>();
    aliases.add(decision.rawValue);
    aliasesByTarget.set(decision.targetId, aliases);
  }
}

const targetedIds = new Set(decisions.flatMap((decision) => decision.namespace === "tag" && decision.targetId ? [decision.targetId] : decision.supplementalTagIds));
const canonicalTags = [...targetedIds].sort(compareCanonicalKeys).map((id) => {
  const spec = tagSpecs[id];
  if (!spec) throw new Error(`Canonical tag specification missing: ${id}`);
  const archive = archiveTagIds.has(id);
  return {
    id,
    label: spec.label,
    slug: id,
    kind: spec.kind,
    aliases: [...(aliasesByTarget.get(id) ?? [])].sort(compareCanonicalKeys),
    archive,
    indexable: archive,
    status: "active" as const,
  };
});

const payload = {
  schemaVersion: 1 as const,
  reviewVersion: "legacy-taxonomy-review-v1" as const,
  rawInventoryManifestPayloadSha256: raw.manifestPayloadSha256,
  decisions,
  canonicalTags,
};
const review = phase5TaxonomyReviewManifestSchema.parse({ ...payload, reviewPayloadSha256: fingerprint(payload) });
writeFileSync("docs/migration/taxonomy-review-v1.json", `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(`Phase 5 taxonomy review generated: ${review.decisions.length} decisions, ${review.canonicalTags.length} canonical tags, hash=${review.reviewPayloadSha256}`);
