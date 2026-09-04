import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";

export const LEGACY_RANKED_PREFIX_BOUNDARY_TIE_CLASS_ID = "ranked-prefix-boundary-tie-v1" as const;

export interface RankedPrefixRecord {
  readonly route: string;
  readonly collection: "blog" | "notes" | "projects" | "tools";
  readonly title: string;
  readonly description?: string;
  readonly pubDateMs: number;
  readonly category?: string;
  readonly tags: readonly string[];
  readonly draft?: boolean;
}

export interface RankedPrefixBoundaryTieVarianceEvidence {
  readonly kind: "ranked_prefix_boundary_tie";
  readonly varianceClassId: typeof LEGACY_RANKED_PREFIX_BOUNDARY_TIE_CLASS_ID;
  readonly path: string;
  readonly regionKey: string;
  readonly sequenceKind: "published" | "related";
  readonly limit: number;
  readonly currentRoute?: string;
  readonly candidateUniverseSha256: string;
  readonly boundarySortKey: readonly number[];
  readonly strictPrefixIdentities: readonly string[];
  readonly boundaryCandidateIdentities: readonly string[];
  readonly selectedFromBoundaryCount: number;
  readonly firstSelectedIdentities: readonly string[];
  readonly secondSelectedIdentities: readonly string[];
  readonly membershipDeltaIdentities: readonly string[];
}

export interface RankedPrefixBoundaryTieProof {
  readonly canonicalToken: string;
  readonly evidence: RankedPrefixBoundaryTieVarianceEvidence;
}

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;

const childrenOf = (node: HtmlNode): readonly HtmlNode[] => "childNodes" in node ? node.childNodes : [];
const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const structuralNode = (node: HtmlNode): unknown => {
  if (node.nodeName === "#text" && "value" in node) return ["text", node.value];
  if (node.nodeName === "#comment" && "data" in node) return ["comment", node.data];
  if (!isElement(node)) return [node.nodeName, childrenOf(node).map(structuralNode)];
  const attrs = [...node.attrs]
    .map((attribute) => [attribute.name, attribute.value] as const)
    .sort((left, right) => compareCanonicalKeys(left[0], right[0]));
  return ["element", node.tagName, attrs, childrenOf(node).map(structuralNode)];
};

const articleFingerprint = (html: string): string => {
  const parseErrors: string[] = [];
  const fragment = parseFragment(html, { onParseError: (error) => parseErrors.push(error.code) }) as HtmlNode;
  if (parseErrors.length > 0) throw new Error(`Compact Blog material HTML parse error: ${parseErrors.join(", ")}`);
  const children = childrenOf(fragment);
  if (children.length !== 1 || !isElement(children[0]!) || children[0]!.tagName !== "article") {
    throw new Error("Compact Blog material must contain exactly one article element");
  }
  return fingerprint(structuralNode(children[0]!));
};

const escapeText = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const escapeAttribute = (value: string): string => escapeText(value).replaceAll('"', "&quot;");

const infraTags = new Set([
  "ai", "anythingllm", "homelab", "migration", "qdrant", "qwen", "rag", "rerank", "self-hosted",
  "ssh", "storage", "tei", "troubleshooting", "vllm", "vps", "windows", "wsl", "wsl2",
]);
const networkTags = new Set(["conoha-vps", "dns", "network", "router", "ssh", "vpn", "webサーバー"]);
const appTags = new Set(["app", "astro", "component", "frontend", "react", "tool", "typescript", "ui", "web"]);
const categoryLabels = { infra: "インフラ", network: "ネットワーク", app: "アプリ", diary: "日記・メモ" } as const;
type CategoryKey = keyof typeof categoryLabels;
const normalizeValue = (value?: string): string => value?.trim().toLowerCase() ?? "";
const categoryKeyFor = (record: RankedPrefixRecord): CategoryKey => {
  const explicit = normalizeValue(record.category);
  if (explicit === "infra" || explicit === "network" || explicit === "app" || explicit === "diary") return explicit;
  if (explicit === "blog") return "diary";
  const tags = record.tags.map((tag) => normalizeValue(tag));
  if (tags.some((tag) => infraTags.has(tag))) return "infra";
  if (tags.some((tag) => networkTags.has(tag))) return "network";
  if (tags.some((tag) => appTags.has(tag))) return "app";
  return "diary";
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" });

export const expectedFrozenCompactBlogCardHtml = (record: RankedPrefixRecord): string => {
  if (record.collection !== "blog") throw new Error(`Compact Blog material requires Blog record: ${record.route}`);
  if (record.description === undefined) throw new Error(`Compact Blog material description missing: ${record.route}`);
  const categoryKey = categoryKeyFor(record);
  const categoryLabel = categoryLabels[categoryKey];
  const published = new Date(record.pubDateMs);
  if (!Number.isFinite(published.getTime())) throw new Error(`Compact Blog material pubDate invalid: ${record.route}`);
  const tags = record.tags.slice(0, 3);
  const tagsHtml = tags.length === 0
    ? ""
    : ` <ul class="mt-5 flex flex-wrap gap-2"> ${tags.map((tag) => `<li class="card-tag"> ${escapeText(tag)} </li>`).join("")} </ul>`;
  return `<article class="refined-card refined-card--elevated motion-card overflow-hidden" data-category="${categoryKey}" data-reveal="card"> <a class="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-paper p-7 sm:p-8" href="${escapeAttribute(record.route)}"> <div class="card-meta"> <span class="card-tag card-tag--strong"> ${escapeText(categoryLabel)} </span> <time datetime="${published.toISOString()}">${escapeText(dateFormatter.format(published))}</time> </div> <h3 class="card-title mt-4 text-[clamp(1.375rem,2vw,1.5rem)]"> ${escapeText(record.title)} </h3> <p class="card-desc mt-4 max-w-[62ch] overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"> ${escapeText(record.description)} </p>${tagsHtml} <div class="card-cta card-footer"> <span>続きを読む</span> <span aria-hidden="true">&rarr;</span> </div> </a> </article>`;
};

const compareTuple = (left: readonly number[], right: readonly number[]): number => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
};

const relatedScore = (current: RankedPrefixRecord, candidate: RankedPrefixRecord): number => {
  const currentTags = new Set(current.tags);
  const sharedTagOccurrences = candidate.tags.filter((tag) => currentTags.has(tag)).length;
  return sharedTagOccurrences * 4 + (current.category && current.category === candidate.category ? 2 : 0);
};

const sortKeyFor = (
  kind: "published" | "related",
  record: RankedPrefixRecord,
  current?: RankedPrefixRecord,
): readonly number[] => {
  if (kind === "related") {
    if (!current) throw new Error("Related ranked prefix requires current Blog record");
    return [-relatedScore(current, record), -record.pubDateMs];
  }
  return [-record.pubDateMs];
};

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const sameSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const a = [...left].sort(compareCanonicalKeys);
  const b = [...right].sort(compareCanonicalKeys);
  return a.every((value, index) => value === b[index]);
};

const symmetricDelta = (left: readonly string[], right: readonly string[]): string[] => {
  const a = new Set(left);
  const b = new Set(right);
  return [...new Set([...left.filter((value) => !b.has(value)), ...right.filter((value) => !a.has(value))])].sort(compareCanonicalKeys);
};

const assertExpectedMaterials = (
  identities: readonly string[],
  materials: ReadonlyMap<string, string>,
  catalog: ReadonlyMap<string, RankedPrefixRecord>,
): void => {
  for (const identity of identities) {
    const record = catalog.get(identity);
    const actual = materials.get(identity);
    if (!record || actual === undefined) throw new Error(`Missing compact Blog proof input for ${identity}`);
    const expected = expectedFrozenCompactBlogCardHtml(record);
    if (articleFingerprint(actual) !== articleFingerprint(expected)) {
      throw new Error(`Compact Blog source/renderer projection mismatch for ${identity}`);
    }
  }
};

const assertValidRealization = (
  identities: readonly string[],
  candidateByRoute: ReadonlyMap<string, RankedPrefixRecord>,
  strictPrefix: ReadonlySet<string>,
  boundary: ReadonlySet<string>,
  selectedBoundaryCount: number,
  kind: "published" | "related",
  current?: RankedPrefixRecord,
): void => {
  if (!unique(identities)) throw new Error("Ranked prefix output contains duplicate identity");
  if (identities.length !== Math.min(3, candidateByRoute.size)) throw new Error("Ranked prefix output cardinality mismatch");
  for (const identity of strictPrefix) if (!identities.includes(identity)) throw new Error(`Ranked prefix strict candidate missing: ${identity}`);
  let boundaryCount = 0;
  for (const identity of identities) {
    if (!candidateByRoute.has(identity)) throw new Error(`Ranked prefix candidate outside frozen universe: ${identity}`);
    if (boundary.has(identity)) boundaryCount += 1;
    else if (!strictPrefix.has(identity)) throw new Error(`Ranked prefix lower-ranked candidate selected: ${identity}`);
  }
  if (boundaryCount !== selectedBoundaryCount) throw new Error("Ranked prefix boundary selection cardinality mismatch");
  for (let index = 1; index < identities.length; index += 1) {
    const left = candidateByRoute.get(identities[index - 1]!)!;
    const right = candidateByRoute.get(identities[index]!)!;
    if (compareTuple(sortKeyFor(kind, left, current), sortKeyFor(kind, right, current)) > 0) {
      throw new Error(`Ranked prefix crosses unequal sort keys: ${left.route} -> ${right.route}`);
    }
  }
};

export const proveRankedPrefixBoundaryTie = (input: Readonly<{
  path: string;
  regionKey: string;
  kind: "published" | "related";
  firstIdentities: readonly string[];
  secondIdentities: readonly string[];
  firstMaterials: ReadonlyMap<string, string>;
  secondMaterials: ReadonlyMap<string, string>;
  gaps: readonly string[];
  catalog: ReadonlyMap<string, RankedPrefixRecord>;
  current?: RankedPrefixRecord;
}>): RankedPrefixBoundaryTieProof | undefined => {
  const isHome = input.path === "index.html" && input.kind === "published";
  const isRelated = /^blog\/.+\/index\.html$/u.test(input.path) && input.kind === "related" && input.current?.collection === "blog";
  if (!isHome && !isRelated) return undefined;
  if (input.firstIdentities.length !== 3 || input.secondIdentities.length !== 3) return undefined;
  if (sameSet(input.firstIdentities, input.secondIdentities)) return undefined;

  const candidates = [...input.catalog.values()]
    .filter((record) => record.collection === "blog" && record.draft !== true)
    .filter((record) => !isRelated || record.route !== input.current!.route);
  if (candidates.length <= 3) return undefined;
  const candidateByRoute = new Map(candidates.map((record) => [record.route, record]));
  if (candidateByRoute.size !== candidates.length) throw new Error("Frozen ranked prefix candidate universe contains duplicate route identity");
  for (const record of candidates) {
    if (!Number.isFinite(record.pubDateMs)) throw new Error(`Frozen ranked prefix pubDate invalid: ${record.route}`);
  }

  const ordered = [...candidates].sort((left, right) => {
    const key = compareTuple(sortKeyFor(input.kind, left, input.current), sortKeyFor(input.kind, right, input.current));
    return key !== 0 ? key : compareCanonicalKeys(left.route, right.route);
  });
  const groups: Array<{ key: readonly number[]; records: RankedPrefixRecord[] }> = [];
  for (const record of ordered) {
    const key = sortKeyFor(input.kind, record, input.current);
    const last = groups.at(-1);
    if (last && compareTuple(last.key, key) === 0) last.records.push(record);
    else groups.push({ key, records: [record] });
  }
  let cumulative = 0;
  let boundaryIndex = -1;
  for (let index = 0; index < groups.length; index += 1) {
    cumulative += groups[index]!.records.length;
    if (cumulative >= 3) { boundaryIndex = index; break; }
  }
  if (boundaryIndex < 0) throw new Error("Ranked prefix boundary group not found");
  const strictRecords = groups.slice(0, boundaryIndex).flatMap((group) => group.records);
  const boundaryGroup = groups[boundaryIndex]!;
  const selectedBoundaryCount = 3 - strictRecords.length;
  if (selectedBoundaryCount <= 0 || selectedBoundaryCount >= boundaryGroup.records.length) return undefined;

  const strictPrefixIdentities = strictRecords.map((record) => record.route).sort(compareCanonicalKeys);
  const boundaryCandidateIdentities = boundaryGroup.records.map((record) => record.route).sort(compareCanonicalKeys);
  const strictSet = new Set(strictPrefixIdentities);
  const boundarySet = new Set(boundaryCandidateIdentities);
  assertValidRealization(input.firstIdentities, candidateByRoute, strictSet, boundarySet, selectedBoundaryCount, input.kind, input.current);
  assertValidRealization(input.secondIdentities, candidateByRoute, strictSet, boundarySet, selectedBoundaryCount, input.kind, input.current);

  const delta = symmetricDelta(input.firstIdentities, input.secondIdentities);
  if (delta.length === 0 || delta.some((identity) => !boundarySet.has(identity))) {
    throw new Error("Ranked prefix membership delta is not confined to the cutoff tie group");
  }

  assertExpectedMaterials(input.firstIdentities, input.firstMaterials, input.catalog);
  assertExpectedMaterials(input.secondIdentities, input.secondMaterials, input.catalog);
  const shared = input.firstIdentities.filter((identity) => input.secondIdentities.includes(identity));
  for (const identity of shared) {
    if (input.firstMaterials.get(identity) !== input.secondMaterials.get(identity)) {
      throw new Error(`Rendered item bytes differ for shared ranked-prefix identity ${identity}`);
    }
  }

  const candidateUniverseSha256 = fingerprint(ordered.map((record) => ({
    route: record.route,
    title: record.title,
    description: record.description,
    pubDateMs: record.pubDateMs,
    category: record.category ?? null,
    tags: [...record.tags],
    draft: record.draft === true,
    sortKey: [...sortKeyFor(input.kind, record, input.current)],
  })));
  const materialModel = [...strictRecords, ...boundaryGroup.records]
    .sort((left, right) => compareCanonicalKeys(left.route, right.route))
    .map((record) => [record.route, articleFingerprint(expectedFrozenCompactBlogCardHtml(record))] as const);
  const canonicalToken = `<!--xpotato-ranked-prefix-equivalent:${fingerprint({
    kind: input.kind,
    path: input.path,
    regionKey: input.regionKey,
    gaps: input.gaps,
    candidateUniverseSha256,
    boundarySortKey: boundaryGroup.key,
    strictPrefixIdentities,
    boundaryCandidateIdentities,
    selectedBoundaryCount,
    materialModel,
  })}-->`;
  return {
    canonicalToken,
    evidence: {
      kind: "ranked_prefix_boundary_tie",
      varianceClassId: LEGACY_RANKED_PREFIX_BOUNDARY_TIE_CLASS_ID,
      path: input.path,
      regionKey: input.regionKey,
      sequenceKind: input.kind,
      limit: 3,
      ...(isRelated ? { currentRoute: input.current!.route } : {}),
      candidateUniverseSha256,
      boundarySortKey: [...boundaryGroup.key],
      strictPrefixIdentities,
      boundaryCandidateIdentities,
      selectedFromBoundaryCount: selectedBoundaryCount,
      firstSelectedIdentities: [...input.firstIdentities],
      secondSelectedIdentities: [...input.secondIdentities],
      membershipDeltaIdentities: delta,
    },
  };
};

export const validateRankedPrefixBoundaryTieVarianceEvidence = (value: unknown): readonly string[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return ["ranked prefix evidence must be an object"];
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.kind !== "ranked_prefix_boundary_tie") errors.push("ranked prefix evidence kind mismatch");
  if (record.varianceClassId !== LEGACY_RANKED_PREFIX_BOUNDARY_TIE_CLASS_ID) errors.push("ranked prefix varianceClassId mismatch");
  if (typeof record.path !== "string" || record.path === "") errors.push("ranked prefix path missing");
  if (typeof record.regionKey !== "string" || record.regionKey === "") errors.push("ranked prefix regionKey missing");
  if (record.sequenceKind !== "published" && record.sequenceKind !== "related") errors.push("ranked prefix sequenceKind invalid");
  if (record.limit !== 3) errors.push("ranked prefix limit must be 3");
  if (typeof record.candidateUniverseSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(record.candidateUniverseSha256)) errors.push("ranked prefix candidateUniverseSha256 invalid");
  for (const field of ["strictPrefixIdentities", "boundaryCandidateIdentities", "firstSelectedIdentities", "secondSelectedIdentities", "membershipDeltaIdentities"] as const) {
    const values = record[field];
    if (!Array.isArray(values) || values.some((item) => typeof item !== "string" || item === "")) errors.push(`ranked prefix ${field} invalid`);
  }
  if (!Array.isArray(record.boundarySortKey) || record.boundarySortKey.some((item) => typeof item !== "number" || !Number.isFinite(item))) errors.push("ranked prefix boundarySortKey invalid");
  if (!Number.isInteger(record.selectedFromBoundaryCount) || Number(record.selectedFromBoundaryCount) <= 0) errors.push("ranked prefix selectedFromBoundaryCount invalid");
  return errors;
};
