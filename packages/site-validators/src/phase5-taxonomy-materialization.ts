import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  phase4ContentMaterializationManifestSchema,
  phase5TaxonomyMaterializationManifestSchema,
  taxonomyRegistrySchema,
  type Phase5TaxonomyMaterializationManifest,
  type Phase5TaxonomyMaterializationRecord,
  type Phase5TaxonomyRawTerm,
  type Phase5TaxonomyReviewDecision,
  type TaxonomyRegistry,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { buildExpectedPhase4Materialization } from "./phase4-content-materialization.js";
import { loadPhase5TaxonomyReview } from "./phase5-taxonomy-review.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const phase4ManifestPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
const phase5ManifestPath = join(repositoryRoot, "docs/migration/taxonomy-materialization-v1.json");
const taxonomyDataPath = join(repositoryRoot, "apps/site/src/content-registry/taxonomy/phase5-generated.ts");
const taxonomyIndexPath = join(repositoryRoot, "apps/site/src/content-registry/taxonomy/index.ts");
const materializationVersion = "legacy-taxonomy-materialization-v1" as const;

interface ParsedContent {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

interface ExpectedPhase5TaxonomyMaterialization {
  readonly manifest: Phase5TaxonomyMaterializationManifest;
  readonly files: ReadonlyMap<string, string>;
  readonly taxonomyRegistry: TaxonomyRegistry;
  readonly taxonomyDataSource: string;
  readonly taxonomyIndexSource: string;
}

const foundationRegistry = taxonomyRegistrySchema.parse({
  schemaVersion: 1,
  blogCategories: [
    { id: "software", label: "ソフトウェア", description: "ソフトウェア設計と実装", slug: "software", indexable: true, aliases: [], status: "active", sortOrder: 10 },
    { id: "infrastructure", label: "インフラストラクチャ", description: "基盤と運用", slug: "infrastructure", indexable: true, aliases: [], status: "active", sortOrder: 20 },
    { id: "robotics", label: "ロボティクス", description: "ロボットと制御", slug: "robotics", indexable: true, aliases: [], status: "active", sortOrder: 30 },
  ],
  noteSubjects: [
    { id: "infrastructure", label: "インフラストラクチャ", description: "基盤作業のノート", slug: "infrastructure", indexable: true, aliases: [], status: "active", archive: true },
  ],
  toolCategories: [
    { id: "calculation", label: "計算", description: "計算用ツール", slug: "calculation", indexable: true, aliases: [], status: "active" },
  ],
  tags: [
    { id: "astro", label: "Astro", slug: "astro", kind: "technology", aliases: [], archive: true, indexable: true, status: "active" },
    { id: "wsl", label: "WSL", slug: "wsl", kind: "technology", aliases: [], archive: true, indexable: true, status: "active" },
    { id: "static-site", label: "静的サイト", slug: "static-site", kind: "topic", aliases: [], archive: true, indexable: true, status: "active" },
  ],
});

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const decisionIdentity = (namespace: string, rawValue: string): string => `${namespace}\0${rawValue}`;

const parseContent = (source: string): ParsedContent => {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) throw new Error("Phase 4 materialized source must start with frontmatter");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Phase 4 materialized source has unterminated frontmatter");
  const parsed = parseYaml(normalized.slice(4, end));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Phase 4 frontmatter must be an object");
  return { frontmatter: parsed as Record<string, unknown>, body: normalized.slice(end + 5).replace(/^\n/u, "") };
};

const serializeContent = (frontmatter: Readonly<Record<string, unknown>>, body: string): string => {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

const mergeRegistry = (migrationTags: TaxonomyRegistry["tags"]): TaxonomyRegistry => {
  const byId = new Map(foundationRegistry.tags.map((tag) => [tag.id, tag]));
  for (const migrationTag of migrationTags) {
    const existing = byId.get(migrationTag.id);
    if (!existing) {
      byId.set(migrationTag.id, migrationTag);
      continue;
    }
    if (existing.kind !== migrationTag.kind || existing.label !== migrationTag.label || existing.slug !== migrationTag.slug) {
      throw new Error(`Phase 5 migration tag conflicts with accepted foundation registry: ${migrationTag.id}`);
    }
    byId.set(migrationTag.id, {
      ...existing,
      aliases: [...new Set([...existing.aliases, ...migrationTag.aliases])].sort(compareCanonicalKeys),
      archive: existing.archive || migrationTag.archive,
      indexable: existing.indexable || migrationTag.indexable,
      status: "active",
    });
  }
  return taxonomyRegistrySchema.parse({
    ...foundationRegistry,
    tags: [...byId.values()].sort((left, right) => compareCanonicalKeys(left.id, right.id)),
  });
};

const taxonomyDataSourceFor = (registry: TaxonomyRegistry): string =>
  `// Generated from docs/migration/taxonomy-review-v1.json by Phase 5. Do not hand-edit.\nexport const phase5TaxonomyRegistryData = ${JSON.stringify(registry, null, 2)} as const;\n`;

const taxonomyIndexSource = `import { taxonomyRegistrySchema } from "@xpotato/content-contracts";\nimport { phase5TaxonomyRegistryData } from "./phase5-generated.js";\n\nexport const taxonomyRegistry = taxonomyRegistrySchema.parse(phase5TaxonomyRegistryData);\n`;

const termAppliesTo = (term: Phase5TaxonomyRawTerm, kind: string, legacyContentId: string): boolean =>
  term.usages.some((usage) => usage.kind === kind && usage.affectedLegacyContentIds.includes(legacyContentId));

const targetFor = (decision: Phase5TaxonomyReviewDecision): string | undefined =>
  decision.disposition === "retire" ? undefined : decision.targetId;

export const buildExpectedPhase5TaxonomyMaterialization = async (): Promise<ExpectedPhase5TaxonomyMaterialization> => {
  const phase4Expected = await buildExpectedPhase4Materialization();
  const phase4Committed = phase4ContentMaterializationManifestSchema.parse(await readJson(phase4ManifestPath));
  if (JSON.stringify(phase4Committed) !== JSON.stringify(phase4Expected.manifest)) {
    throw new Error("Phase 4 materialization manifest drift must be resolved before Phase 5 overlay");
  }
  const { rawInventory, review } = await loadPhase5TaxonomyReview();
  if (rawInventory.materializationManifestPayloadSha256 !== phase4Expected.manifest.manifestPayloadSha256) {
    throw new Error("Phase 5 raw inventory is not bound to the current Phase 4 materialization manifest");
  }

  const taxonomyRegistry = mergeRegistry(review.canonicalTags);
  const tagById = new Map(taxonomyRegistry.tags.map((tag) => [tag.id, tag]));
  const decisionByIdentity = new Map(review.decisions.map((decision) => [decisionIdentity(decision.namespace, decision.rawValue), decision]));
  const phase4RecordById = new Map(phase4Expected.manifest.records.map((record) => [record.legacyContentId, record]));
  const files = new Map<string, string>();
  const records: Phase5TaxonomyMaterializationRecord[] = [];

  for (const phase4Record of [...phase4Expected.manifest.records].sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId))) {
    const phase4Source = phase4Expected.files.get(phase4Record.targetPath);
    if (!phase4Source) throw new Error(`Phase 4 expected content missing: ${phase4Record.legacyContentId}`);
    const parsed = parseContent(phase4Source);
    const tags = new Set<string>();
    const stack = new Set<string>();
    const retiredRawTerms = new Set<string>();
    let appliedRawTermCount = 0;

    for (const term of rawInventory.terms) {
      const decision = decisionByIdentity.get(decisionIdentity(term.namespace, term.rawValue));
      if (!decision) throw new Error(`Phase 5 review decision missing during overlay: ${term.namespace}:${term.rawValue}`);
      const applicableKinds = term.usages.filter((usage) => usage.affectedLegacyContentIds.includes(phase4Record.legacyContentId)).map((usage) => usage.kind);
      if (applicableKinds.length === 0) continue;
      appliedRawTermCount += applicableKinds.length;

      if (term.namespace === "blog_category") {
        if (!termAppliesTo(term, "blog_category", phase4Record.legacyContentId)) throw new Error("Blog category usage mismatch");
        if (parsed.frontmatter.category !== decision.targetId) throw new Error(`${phase4Record.legacyContentId}: Phase 4 category does not match reviewed Phase 5 category target`);
        for (const tagId of decision.supplementalTagIds) tags.add(tagId);
        continue;
      }
      if (term.namespace === "note_subject") {
        if (parsed.frontmatter.subject !== decision.targetId) throw new Error(`${phase4Record.legacyContentId}: Phase 4 subject does not match reviewed Phase 5 subject target`);
        continue;
      }
      if (term.namespace === "tool_category") {
        if (parsed.frontmatter.category !== decision.targetId) throw new Error(`${phase4Record.legacyContentId}: Phase 4 Tool category does not match reviewed Phase 5 target`);
        continue;
      }

      const targetId = targetFor(decision);
      for (const kind of applicableKinds) {
        if (!targetId) {
          retiredRawTerms.add(term.rawValue);
          continue;
        }
        if (kind === "project_technology") stack.add(targetId);
        else tags.add(targetId);
      }
    }

    const tagIds = [...tags].sort(compareCanonicalKeys);
    const stackIds = [...stack].sort(compareCanonicalKeys);
    for (const tagId of tagIds) if (!tagById.has(tagId)) throw new Error(`${phase4Record.legacyContentId}: unknown Phase 5 tag ${tagId}`);
    for (const stackId of stackIds) {
      const tag = tagById.get(stackId);
      if (!tag || tag.kind !== "technology") throw new Error(`${phase4Record.legacyContentId}: stack target is not technology ${stackId}`);
    }

    if ("tags" in parsed.frontmatter) parsed.frontmatter.tags = tagIds;
    else if (tagIds.length > 0) throw new Error(`${phase4Record.legacyContentId}: taxonomy tag overlay reached a collection without tags`);
    if (phase4Record.collection === "projects") {
      if (stackIds.length > 0) parsed.frontmatter.stack = stackIds;
      else delete parsed.frontmatter.stack;
    } else if (stackIds.length > 0) throw new Error(`${phase4Record.legacyContentId}: non-Project content received stack IDs`);

    const finalSource = serializeContent(parsed.frontmatter, parsed.body);
    files.set(phase4Record.targetPath, finalSource);
    const core = {
      legacyContentId: phase4Record.legacyContentId,
      targetPath: phase4Record.targetPath,
      phase4TargetFileSha256: phase4Record.targetFileSha256,
      finalTargetFileSha256: sha256(finalSource),
      finalFrontmatterSha256: fingerprint(parsed.frontmatter),
      ...(phase4Record.collection === "blog" ? { categoryId: String(parsed.frontmatter.category) } : {}),
      ...(phase4Record.collection === "notes" ? { subjectId: String(parsed.frontmatter.subject) } : {}),
      ...(phase4Record.collection === "tools" ? { toolCategoryId: String(parsed.frontmatter.category) } : {}),
      tagIds,
      stackIds,
      retiredRawTerms: [...retiredRawTerms].sort(compareCanonicalKeys),
      appliedRawTermCount,
    } as const;
    records.push({ ...core, recordPayloadSha256: fingerprint(core) });
  }

  if (records.length !== phase4Expected.manifest.records.length || files.size !== phase4Expected.files.size) {
    throw new Error("Phase 5 taxonomy overlay must cover every Phase 4 materialized entity exactly once");
  }
  for (const term of rawInventory.terms) {
    if (!term.affectedLegacyContentIds.every((legacyContentId) => phase4RecordById.has(legacyContentId))) {
      throw new Error(`Phase 5 raw taxonomy references unknown Phase 4 content: ${term.rawValue}`);
    }
  }

  const payload = {
    schemaVersion: 1 as const,
    materializationVersion,
    phase4MaterializationManifestPayloadSha256: phase4Expected.manifest.manifestPayloadSha256,
    rawInventoryManifestPayloadSha256: rawInventory.manifestPayloadSha256,
    reviewPayloadSha256: review.reviewPayloadSha256,
    taxonomyRegistryPayloadSha256: fingerprint(taxonomyRegistry),
    records,
  };
  const manifest = phase5TaxonomyMaterializationManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
  return {
    manifest,
    files,
    taxonomyRegistry,
    taxonomyDataSource: taxonomyDataSourceFor(taxonomyRegistry),
    taxonomyIndexSource,
  };
};

export const writePhase5TaxonomyMaterialization = async (): Promise<Phase5TaxonomyMaterializationManifest> => {
  const expected = await buildExpectedPhase5TaxonomyMaterialization();
  for (const [repositoryPath, source] of expected.files) {
    const path = join(repositoryRoot, repositoryPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, "utf8");
  }
  await mkdir(dirname(taxonomyDataPath), { recursive: true });
  await writeFile(taxonomyDataPath, expected.taxonomyDataSource, "utf8");
  await writeFile(taxonomyIndexPath, expected.taxonomyIndexSource, "utf8");
  await writeFile(phase5ManifestPath, `${JSON.stringify(expected.manifest, null, 2)}\n`, "utf8");
  return expected.manifest;
};

export const checkPhase5TaxonomyMaterialization = async (): Promise<Phase5TaxonomyMaterializationManifest> => {
  const expected = await buildExpectedPhase5TaxonomyMaterialization();
  const committedManifest = phase5TaxonomyMaterializationManifestSchema.parse(await readJson(phase5ManifestPath));
  if (JSON.stringify(committedManifest) !== JSON.stringify(expected.manifest)) throw new Error("Committed Phase 5 taxonomy materialization manifest drifted from exact regeneration");
  for (const [repositoryPath, expectedSource] of expected.files) {
    const actualSource = await readFile(join(repositoryRoot, repositoryPath), "utf8").catch(() => undefined);
    if (actualSource !== expectedSource) throw new Error(`Phase 5 taxonomy materialized content drift: ${repositoryPath}`);
  }
  if (await readFile(taxonomyDataPath, "utf8").catch(() => undefined) !== expected.taxonomyDataSource) throw new Error("Phase 5 generated taxonomy registry data drift");
  if (await readFile(taxonomyIndexPath, "utf8").catch(() => undefined) !== expected.taxonomyIndexSource) throw new Error("Phase 5 taxonomy registry index drift");
  return committedManifest;
};
