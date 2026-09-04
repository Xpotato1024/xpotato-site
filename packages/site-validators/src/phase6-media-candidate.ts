import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  phase4ContentMaterializationManifestSchema,
  phase6MediaRawInventorySchema,
  phase6MediaRepositoryCandidateManifestSchema,
  phase6MediaReviewProposalSchema,
  type Phase6DeterministicSourceRecord,
  type Phase6MediaProcessingPlanRecord,
  type Phase6MediaProvenanceRecord,
  type Phase6MediaRepositoryCandidateManifest,
  type Phase6RightsBinding,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { phase6MediaRawInventoryPath } from "./phase6-media-inventory.js";
import { phase6MediaReviewProposalPath } from "./phase6-media-review.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const phase4MaterializationPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
export const phase6MediaRepositoryCandidatePath = join(repositoryRoot, "docs/migration/media-repository-candidate-v1.json");
export const phase6DeterministicSourceRoot = join(repositoryRoot, ".local/migration/phase6/deterministic-sources");

export const PHASE6_ACCEPTED_MEDIA_REVIEW_SHA256 = "49fe35022d3a573c2575b81add0195921673b17e8ba2da1c8f4707668b8ee3e8";
export const PHASE6_MEDIA_REVIEW_ACCEPTANCE_RECORD = "docs/migration/phase6-media-review-acceptance-2026-09-04.md";
const candidateVersion = "legacy-media-repository-candidate-v1" as const;
const confirmedAt = "2026-09-04T03:45:00+09:00";

type Review = ReturnType<typeof phase6MediaReviewProposalSchema.parse>;
type RawInventory = ReturnType<typeof phase6MediaRawInventorySchema.parse>;
type Phase4 = ReturnType<typeof phase4ContentMaterializationManifestSchema.parse>;

type SemanticPlan = Readonly<{
  legacyContentId: string;
  contentId: string;
  assetId: string;
  role: "hero" | "inline" | "overview" | "social_card";
  sourceAction: "ingest_git_object" | "recover_nonlocal_source" | "generate_deterministic";
  ingestProfileId: string;
  variantProfileId?: string;
  legacyLocator?: string;
}>;

interface ContentPresentationMetadata {
  readonly title: string;
  readonly category?: string;
}

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;
const keyOf = (contentId: string, assetId: string): string => `${contentId}\0${assetId}`;
const sortBySemanticKey = <T extends { contentId: string; assetId: string }>(values: Iterable<T>): T[] =>
  [...values].sort((left, right) => compareCanonicalKeys(keyOf(left.contentId, left.assetId), keyOf(right.contentId, right.assetId)));

const parseFrontmatter = async (repositoryPath: string): Promise<Readonly<Record<string, unknown>>> => {
  const source = await readFile(join(repositoryRoot, repositoryPath), "utf8");
  const match = /^---\r?\n(?<frontmatter>[\s\S]*?\r?\n)---(?:\r?\n|$)/u.exec(source);
  const frontmatter = match?.groups?.frontmatter;
  if (frontmatter === undefined) throw new Error(`${repositoryPath}: frontmatter missing`);
  const parsed = parseYaml(frontmatter);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${repositoryPath}: frontmatter must be a mapping`);
  return parsed as Readonly<Record<string, unknown>>;
};

const xmlEscape = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const titleLines = (title: string): string[] => {
  const chars = Array.from(title.trim());
  const maxPerLine = 21;
  const maxLines = 3;
  const lines: string[] = [];
  for (let index = 0; index < chars.length && lines.length < maxLines; index += maxPerLine) {
    lines.push(chars.slice(index, index + maxPerLine).join(""));
  }
  if (chars.length > maxPerLine * maxLines && lines.length > 0) {
    lines[lines.length - 1] = `${Array.from(lines[lines.length - 1]!).slice(0, maxPerLine - 1).join("")}…`;
  }
  return lines.length > 0 ? lines : ["Untitled"];
};

const paletteFor = (contentId: string): Readonly<{ base: string; accent: string; accent2: string }> => {
  const digest = sha256(contentId);
  const channels = [digest.slice(0, 2), digest.slice(2, 4), digest.slice(4, 6)].map((value) => Number.parseInt(value, 16));
  const hue = (channels[0]! * 3 + channels[1]!) % 360;
  const hue2 = (hue + 58 + channels[2]! % 72) % 360;
  return {
    base: `hsl(${hue} 42% 10%)`,
    accent: `hsl(${hue} 78% 58%)`,
    accent2: `hsl(${hue2} 72% 62%)`,
  };
};

export const renderPhase6BlogHeroSvg = (contentId: string): string => {
  const palette = paletteFor(contentId);
  const digest = sha256(`hero:${contentId}`);
  const x1 = 160 + Number.parseInt(digest.slice(0, 4), 16) % 380;
  const y1 = 130 + Number.parseInt(digest.slice(4, 8), 16) % 240;
  const x2 = 900 + Number.parseInt(digest.slice(8, 12), 16) % 420;
  const y2 = 430 + Number.parseInt(digest.slice(12, 16), 16) % 280;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="Decorative article cover">\n` +
    `  <rect width="1600" height="900" rx="48" fill="${palette.base}"/>\n` +
    `  <circle cx="${x1}" cy="${y1}" r="330" fill="${palette.accent}" fill-opacity="0.26"/>\n` +
    `  <circle cx="${x2}" cy="${y2}" r="410" fill="${palette.accent2}" fill-opacity="0.18"/>\n` +
    `  <path d="M120 700 C420 470 690 790 980 520 S1390 350 1510 190" fill="none" stroke="${palette.accent}" stroke-width="18" stroke-opacity="0.42"/>\n` +
    `  <rect x="118" y="112" width="1364" height="676" rx="54" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>\n` +
    `</svg>\n`;
};

export const renderPhase6BlogSocialSourceSvg = (contentId: string, title: string, category: string | undefined): string => {
  const palette = paletteFor(contentId);
  const lines = titleLines(title);
  const tspans = lines.map((line, index) => `    <tspan x="96" dy="${index === 0 ? 0 : 74}">${xmlEscape(line)}</tspan>`).join("\n");
  const categoryText = xmlEscape((category ?? "article").toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">\n` +
    `  <rect width="1200" height="630" fill="${palette.base}"/>\n` +
    `  <circle cx="1030" cy="90" r="310" fill="${palette.accent}" fill-opacity="0.2"/>\n` +
    `  <circle cx="1060" cy="600" r="260" fill="${palette.accent2}" fill-opacity="0.15"/>\n` +
    `  <text x="96" y="94" fill="${palette.accent}" font-family="Noto Sans JP, IBM Plex Sans JP, sans-serif" font-size="24" font-weight="700" letter-spacing="4">${categoryText}</text>\n` +
    `  <text x="96" y="218" fill="#f8fafc" font-family="Noto Sans JP, IBM Plex Sans JP, sans-serif" font-size="58" font-weight="800">\n${tspans}\n  </text>\n` +
    `  <text x="96" y="560" fill="#cbd5e1" font-family="Noto Sans JP, IBM Plex Sans JP, sans-serif" font-size="28" font-weight="600">xpotato.net</text>\n` +
    `  <rect x="72" y="52" width="1056" height="526" rx="38" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>\n` +
    `</svg>\n`;
};

export const renderPhase6ConohaSshDiagramSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-label="SSH public key authentication flow">\n` +
  `  <rect width="1200" height="720" rx="36" fill="#0b1220"/>\n` +
  `  <text x="600" y="72" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="34" font-weight="700">SSH public key authentication</text>\n` +
  `  <rect x="90" y="180" width="280" height="300" rx="28" fill="#111c30" stroke="#60a5fa" stroke-width="3"/>\n` +
  `  <text x="230" y="230" text-anchor="middle" fill="#93c5fd" font-family="sans-serif" font-size="28" font-weight="700">Local PC</text>\n` +
  `  <rect x="132" y="282" width="196" height="72" rx="18" fill="#172554"/>\n` +
  `  <text x="230" y="327" text-anchor="middle" fill="#e0e7ff" font-family="monospace" font-size="22">ssh-keygen</text>\n` +
  `  <text x="230" y="406" text-anchor="middle" fill="#fca5a5" font-family="sans-serif" font-size="22" font-weight="700">Private key stays here</text>\n` +
  `  <rect x="830" y="180" width="280" height="300" rx="28" fill="#111c30" stroke="#34d399" stroke-width="3"/>\n` +
  `  <text x="970" y="230" text-anchor="middle" fill="#6ee7b7" font-family="sans-serif" font-size="28" font-weight="700">VPS</text>\n` +
  `  <rect x="862" y="300" width="216" height="72" rx="18" fill="#064e3b"/>\n` +
  `  <text x="970" y="343" text-anchor="middle" fill="#d1fae5" font-family="monospace" font-size="19">authorized_keys</text>\n` +
  `  <path d="M370 325 H830" stroke="#60a5fa" stroke-width="8" stroke-linecap="round"/>\n` +
  `  <path d="M808 303 L840 325 L808 347" fill="none" stroke="#60a5fa" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>\n` +
  `  <text x="600" y="294" text-anchor="middle" fill="#bfdbfe" font-family="sans-serif" font-size="24" font-weight="700">Copy only the public key</text>\n` +
  `  <path d="M830 420 H370" stroke="#a78bfa" stroke-width="7" stroke-linecap="round" stroke-dasharray="18 16"/>\n` +
  `  <path d="M392 398 L360 420 L392 442" fill="none" stroke="#a78bfa" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>\n` +
  `  <text x="600" y="466" text-anchor="middle" fill="#ddd6fe" font-family="sans-serif" font-size="22">Server proves access; private key is never uploaded</text>\n` +
  `  <rect x="238" y="560" width="724" height="92" rx="24" fill="#111827" stroke="#334155"/>\n` +
  `  <text x="600" y="617" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="24">Conceptual diagram — not a reproduction of any provider control panel</text>\n` +
  `</svg>\n`;

const deterministicRecord = (
  input: Readonly<{
    legacyContentId: string;
    contentId: string;
    assetId: string;
    role: "hero" | "inline" | "social_card";
    templateId: Phase6DeterministicSourceRecord["templateId"];
    width: number;
    height: number;
    source: string;
  }>,
): Phase6DeterministicSourceRecord => ({
  legacyContentId: input.legacyContentId,
  contentId: input.contentId,
  assetId: input.assetId,
  role: input.role,
  templateId: input.templateId,
  format: "svg",
  width: input.width,
  height: input.height,
  sha256: sha256(input.source),
  sizeBytes: Buffer.byteLength(input.source, "utf8"),
});

const collectSemanticPlans = (review: Review): SemanticPlan[] => {
  const plans = new Map<string, SemanticPlan>();
  const add = (plan: SemanticPlan): void => {
    const key = keyOf(plan.contentId, plan.assetId);
    const existing = plans.get(key);
    if (existing && fingerprint(existing) !== fingerprint(plan)) throw new Error(`Conflicting Phase 6 semantic plan: ${key}`);
    plans.set(key, plan);
  };
  for (const decision of review.decisions) {
    for (const plan of decision.assetPlans) {
      add({
        legacyContentId: plan.legacyContentId,
        contentId: plan.contentId,
        assetId: plan.assetId,
        role: plan.role,
        sourceAction: plan.sourceAction,
        ingestProfileId: plan.ingestProfileId ?? "diagram-svg-v1",
        ...(plan.variantProfileId ? { variantProfileId: plan.variantProfileId } : {}),
        ...(plan.sourceAction === "generate_deterministic" ? {} : { legacyLocator: decision.legacyLocator }),
      });
    }
  }
  for (const blog of review.blogPublicationPlans) {
    add({
      legacyContentId: blog.legacyContentId,
      contentId: blog.contentId,
      assetId: "hero",
      role: "hero",
      sourceAction: blog.hero.origin === "legacy_media" ? "recover_nonlocal_source" : "generate_deterministic",
      ingestProfileId: blog.hero.origin === "legacy_media" ? "canonical-raster-srgb8-lossless-webp-v1" : "diagram-svg-v1",
      ...(blog.hero.origin === "legacy_media" ? { variantProfileId: "photo-hero-v1", legacyLocator: blog.hero.sourceLocator! } : {}),
    });
    add({
      legacyContentId: blog.legacyContentId,
      contentId: blog.contentId,
      assetId: "social-card",
      role: "social_card",
      sourceAction: "generate_deterministic",
      ingestProfileId: "diagram-svg-v1",
      variantProfileId: "social-card-v1",
    });
  }
  return sortBySemanticKey(plans.values());
};

const buildMetadataMap = async (phase4: Phase4): Promise<Map<string, ContentPresentationMetadata>> => {
  const result = new Map<string, ContentPresentationMetadata>();
  for (const record of phase4.records) {
    const data = await parseFrontmatter(record.targetPath);
    const title = data.title;
    if (typeof title !== "string" || title.trim().length === 0) throw new Error(`${record.targetPath}: title missing`);
    const category = typeof data.category === "string" ? data.category : undefined;
    result.set(record.legacyContentId, { title, ...(category ? { category } : {}) });
  }
  return result;
};

const deterministicSourcesFor = (
  plans: readonly SemanticPlan[],
  metadata: ReadonlyMap<string, ContentPresentationMetadata>,
): Readonly<{ records: Phase6DeterministicSourceRecord[]; bytes: Map<string, string> }> => {
  const records: Phase6DeterministicSourceRecord[] = [];
  const bytes = new Map<string, string>();
  for (const plan of plans.filter((item) => item.sourceAction === "generate_deterministic")) {
    const meta = metadata.get(plan.legacyContentId);
    if (!meta) throw new Error(`${plan.legacyContentId}: presentation metadata missing`);
    let templateId: Phase6DeterministicSourceRecord["templateId"];
    let width: number;
    let height: number;
    let source: string;
    if (plan.legacyContentId === "blog:2025-10-06" && plan.assetId === "inline-01") {
      templateId = "conoha-ssh-key-flow-v1";
      width = 1200;
      height = 720;
      source = renderPhase6ConohaSshDiagramSvg();
    } else if (plan.assetId === "social-card") {
      templateId = "blog-social-card-source-v1";
      width = 1200;
      height = 630;
      source = renderPhase6BlogSocialSourceSvg(plan.contentId, meta.title, meta.category);
    } else if (plan.assetId === "hero" && plan.role === "hero") {
      templateId = "blog-hero-geometric-v1";
      width = 1600;
      height = 900;
      source = renderPhase6BlogHeroSvg(plan.contentId);
    } else {
      throw new Error(`Unsupported deterministic semantic asset: ${plan.legacyContentId}/${plan.assetId}`);
    }
    const record = deterministicRecord({
      legacyContentId: plan.legacyContentId,
      contentId: plan.contentId,
      assetId: plan.assetId,
      role: plan.role as "hero" | "inline" | "social_card",
      templateId,
      width,
      height,
      source,
    });
    records.push(record);
    bytes.set(keyOf(plan.contentId, plan.assetId), source);
  }
  return { records: sortBySemanticKey(records), bytes };
};

const rawRecordFor = (raw: RawInventory, locator: string): RawInventory["records"][number] => {
  const record = raw.records.find((item) => item.legacyLocator === locator);
  if (!record) throw new Error(`Raw media evidence missing for ${locator}`);
  return record;
};

const processingPlanFor = (plan: SemanticPlan): Phase6MediaProcessingPlanRecord => {
  if (plan.sourceAction === "generate_deterministic") {
    if (plan.assetId === "social-card") {
      return {
        legacyContentId: plan.legacyContentId,
        contentId: plan.contentId,
        assetId: plan.assetId,
        role: plan.role,
        sourceClass: "svg",
        sourceStatus: "ready",
        canonicalAction: "sanitize_svg",
        deliveryAction: "social_card_png",
        ingestProfileId: "diagram-svg-v1",
        variantProfileId: "social-card-v1",
        blockers: ["social_card_rasterizer"],
      };
    }
    return {
      legacyContentId: plan.legacyContentId,
      contentId: plan.contentId,
      assetId: plan.assetId,
      role: plan.role,
      sourceClass: "svg",
      sourceStatus: "ready",
      canonicalAction: "sanitize_svg",
      deliveryAction: "fixed_svg",
      ingestProfileId: "diagram-svg-v1",
      blockers: [],
    };
  }
  if (plan.sourceAction === "recover_nonlocal_source") {
    return {
      legacyContentId: plan.legacyContentId,
      contentId: plan.contentId,
      assetId: plan.assetId,
      role: plan.role,
      sourceClass: "nonlocal",
      sourceStatus: "recovery_required",
      canonicalAction: "recover_then_raster_ingest",
      deliveryAction: "responsive_variants",
      ingestProfileId: plan.ingestProfileId,
      ...(plan.variantProfileId ? { variantProfileId: plan.variantProfileId } : {}),
      blockers: ["nonlocal_source_recovery", "raster_encoder_toolchain"],
    };
  }
  if (plan.ingestProfileId === "diagram-svg-v1") {
    return {
      legacyContentId: plan.legacyContentId,
      contentId: plan.contentId,
      assetId: plan.assetId,
      role: plan.role,
      sourceClass: "svg",
      sourceStatus: "ready",
      canonicalAction: "sanitize_svg",
      deliveryAction: "fixed_svg",
      ingestProfileId: plan.ingestProfileId,
      blockers: [],
    };
  }
  return {
    legacyContentId: plan.legacyContentId,
    contentId: plan.contentId,
    assetId: plan.assetId,
    role: plan.role,
    sourceClass: "raster",
    sourceStatus: "ready",
    canonicalAction: "raster_ingest",
    deliveryAction: "responsive_variants",
    ingestProfileId: plan.ingestProfileId,
    ...(plan.variantProfileId ? { variantProfileId: plan.variantProfileId } : {}),
    blockers: ["raster_encoder_toolchain"],
  };
};

const rightsFor = (plan: SemanticPlan): Phase6RightsBinding => ({
  rightsId: `rights-${plan.contentId}-${plan.assetId}`,
  contentId: plan.contentId,
  assetId: plan.assetId,
  basis: "self_created",
  publicationAuthorized: true,
  confirmedBy: "user",
  confirmedAt,
  acceptedReviewPayloadSha256: PHASE6_ACCEPTED_MEDIA_REVIEW_SHA256,
});

const provenanceFor = (
  plan: SemanticPlan,
  raw: RawInventory,
  deterministic: ReadonlyMap<string, Phase6DeterministicSourceRecord>,
): Phase6MediaProvenanceRecord => {
  const base = {
    provenanceId: `provenance-${plan.contentId}-${plan.assetId}`,
    legacyContentId: plan.legacyContentId,
    contentId: plan.contentId,
    assetId: plan.assetId,
  } as const;
  let core: Omit<Phase6MediaProvenanceRecord, "provenancePayloadSha256">;
  if (plan.sourceAction === "generate_deterministic") {
    const record = deterministic.get(keyOf(plan.contentId, plan.assetId));
    if (!record) throw new Error(`Deterministic source record missing for ${plan.contentId}/${plan.assetId}`);
    core = {
      ...base,
      origin: "deterministic_generator",
      deterministicSourceSha256: record.sha256,
      templateId: record.templateId,
      status: "deterministic_regenerable",
    };
  } else if (plan.sourceAction === "recover_nonlocal_source") {
    if (!plan.legacyLocator) throw new Error(`Nonlocal recovery plan missing locator: ${plan.contentId}/${plan.assetId}`);
    const rawRecord = rawRecordFor(raw, plan.legacyLocator);
    if (rawRecord.verificationStatus !== "unresolved_non_local") throw new Error(`Nonlocal plan unexpectedly resolved in Git: ${plan.legacyLocator}`);
    core = {
      ...base,
      origin: "legacy_nonlocal_recovery",
      legacyLocator: plan.legacyLocator,
      status: "source_recovery_required",
    };
  } else {
    if (!plan.legacyLocator) throw new Error(`Git media plan missing locator: ${plan.contentId}/${plan.assetId}`);
    const rawRecord = rawRecordFor(raw, plan.legacyLocator);
    if (rawRecord.verificationStatus !== "git_verified") throw new Error(`Git media plan lacks verified bytes: ${plan.legacyLocator}`);
    core = {
      ...base,
      origin: "legacy_git",
      legacyLocator: plan.legacyLocator,
      repositoryPath: rawRecord.repositoryPath,
      sourceSha256: rawRecord.sourceFileSha256,
      status: "source_verified",
    };
  }
  return { ...core, provenancePayloadSha256: fingerprint(core) };
};

export const buildPhase6MediaRepositoryCandidate = async (): Promise<Readonly<{
  manifest: Phase6MediaRepositoryCandidateManifest;
  deterministicSourceBytes: ReadonlyMap<string, string>;
}>> => {
  const review = phase6MediaReviewProposalSchema.parse(await readJson(phase6MediaReviewProposalPath));
  if (review.reviewPayloadSha256 !== PHASE6_ACCEPTED_MEDIA_REVIEW_SHA256) {
    throw new Error(`Phase 6 review payload is not the operator-accepted revision: ${review.reviewPayloadSha256}`);
  }
  const raw = phase6MediaRawInventorySchema.parse(await readJson(phase6MediaRawInventoryPath));
  if (review.rawInventoryManifestPayloadSha256 !== raw.manifestPayloadSha256) throw new Error("Phase 6 review/raw inventory binding mismatch");
  const phase4 = phase4ContentMaterializationManifestSchema.parse(await readJson(phase4MaterializationPath));
  const plans = collectSemanticPlans(review);
  if (plans.length !== 101) throw new Error(`Expected exactly 101 reviewed semantic media assets, got ${plans.length}`);
  const metadata = await buildMetadataMap(phase4);
  const deterministic = deterministicSourcesFor(plans, metadata);
  if (deterministic.records.length !== 89) throw new Error(`Expected 89 deterministic SVG sources, got ${deterministic.records.length}`);
  const deterministicByKey = new Map(deterministic.records.map((record) => [keyOf(record.contentId, record.assetId), record]));
  const rightsBindings = sortBySemanticKey(plans.map(rightsFor));
  const provenance = sortBySemanticKey(plans.map((plan) => provenanceFor(plan, raw, deterministicByKey)));
  const processingPlan = sortBySemanticKey(plans.map(processingPlanFor));
  const payload = {
    schemaVersion: 1 as const,
    candidateVersion,
    acceptedReviewPayloadSha256: PHASE6_ACCEPTED_MEDIA_REVIEW_SHA256,
    rawInventoryManifestPayloadSha256: raw.manifestPayloadSha256,
    reviewAcceptanceRecordPath: PHASE6_MEDIA_REVIEW_ACCEPTANCE_RECORD,
    deterministicSources: deterministic.records,
    rightsBindings,
    provenance,
    processingPlan,
    persistentMutationAuthorized: false as const,
  };
  const manifest = phase6MediaRepositoryCandidateManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
  return { manifest, deterministicSourceBytes: deterministic.bytes };
};

export const writePhase6MediaRepositoryCandidate = async (emitSources = false): Promise<Phase6MediaRepositoryCandidateManifest> => {
  const result = await buildPhase6MediaRepositoryCandidate();
  await writeFile(phase6MediaRepositoryCandidatePath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");
  if (emitSources) {
    for (const record of result.manifest.deterministicSources) {
      const source = result.deterministicSourceBytes.get(keyOf(record.contentId, record.assetId));
      if (!source) throw new Error(`Deterministic source bytes missing for ${record.contentId}/${record.assetId}`);
      const file = join(phase6DeterministicSourceRoot, record.contentId, `${record.assetId}.svg`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, source, "utf8");
    }
  }
  return result.manifest;
};

export const checkPhase6MediaRepositoryCandidate = async (): Promise<Phase6MediaRepositoryCandidateManifest> => {
  const expected = await buildPhase6MediaRepositoryCandidate();
  const committed = phase6MediaRepositoryCandidateManifestSchema.parse(await readJson(phase6MediaRepositoryCandidatePath));
  if (JSON.stringify(committed) !== JSON.stringify(expected.manifest)) {
    throw new Error("Committed Phase 6 repository media candidate differs from exact accepted-review regeneration");
  }
  return committed;
};
