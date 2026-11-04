import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { compareCanonicalKeys, fingerprint } from "@xpotato/content-contracts/canonical";
import { normalizeBuiltFileToEndpoint } from "./legacy-inventory.js";
import type { LegacyDistManifest } from "./legacy-reproduction.js";
import {
  proveRankedPrefixBoundaryTie,
  validateRankedPrefixBoundaryTieVarianceEvidence,
  type RankedPrefixBoundaryTieVarianceEvidence,
  type RankedPrefixRecord,
} from "./legacy-ranked-prefix-equivalence.js";

export const LEGACY_BUILD_EQUIVALENCE_PROFILE_ID = "legacy-build-equivalence-v1" as const;

type HtmlNode = DefaultTreeAdapterTypes.Node;
type HtmlElement = DefaultTreeAdapterTypes.Element;
type ContentCollection = "blog" | "notes" | "projects" | "tools";

export interface LegacySortRecord extends RankedPrefixRecord {
  readonly collection: ContentCollection;
  readonly featuredOrder?: number;
}

export interface LegacyBuildSourceIdentity {
  readonly repository: string;
  readonly tag: string;
  readonly tagObjectSha: string;
  readonly commitSha: string;
  readonly packageLockBlobSha: string;
}

export interface LegacyBuildObservation {
  readonly rawDistManifestSha256: string;
  readonly fileCount: number;
  readonly endpointPathsSha256: string;
  readonly nonHtmlManifestSha256: string;
}

export interface LegacyBuildReproductionEvidence {
  readonly schemaVersion: 1;
  readonly equivalenceProfileId: typeof LEGACY_BUILD_EQUIVALENCE_PROFILE_ID;
  readonly source: LegacyBuildSourceIdentity;
  readonly toolchain: Readonly<{
    nodeVersion: string;
    npmVersion: string;
    buildCommands: readonly ["npm ci", "npm run check", "npm run build"];
  }>;
  readonly builds: readonly LegacyBuildObservation[];
  readonly permittedBoundarySelectionVariances: readonly RankedPrefixBoundaryTieVarianceEvidence[];
  readonly result:
    | Readonly<{
        status: "PASS";
        rawByteIdentical: boolean;
        equivalenceVerified: true;
        differingHtmlPaths: readonly string[];
        permittedTiePermutationCount: number;
      }>
    | Readonly<{
        status: "FAIL";
        equivalenceVerified: false;
        reason: string;
        differingPaths: readonly string[];
      }>;
}

export interface LegacyHtmlBuild {
  readonly manifest: LegacyDistManifest;
  readonly html: ReadonlyMap<string, string>;
}

interface SourceLocation {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly startTag?: Readonly<{ endOffset: number }>;
  readonly endTag?: Readonly<{ startOffset: number }>;
}

interface SequenceDescriptor {
  readonly key: string;
  readonly kind: "published" | "related";
  readonly startOffset: number;
  readonly endOffset: number;
  readonly identities: readonly string[];
  readonly materials: ReadonlyMap<string, string>;
  readonly gaps: readonly string[];
}

interface FeaturedDescriptor {
  readonly key: string;
  readonly kind: "featured";
  readonly startOffset: number;
  readonly endOffset: number;
  readonly baseIdentities: readonly string[];
  readonly materials: ReadonlyMap<string, string>;
  readonly skeleton: string;
}

type RegionDescriptor = SequenceDescriptor | FeaturedDescriptor;

interface RegionProof {
  readonly canonicalToken: string;
  readonly tiePermutationCount: number;
  readonly boundarySelectionVariances: readonly RankedPrefixBoundaryTieVarianceEvidence[];
}

export interface LegacyBuildEquivalenceInput {
  readonly path: string;
  readonly firstHtml: string;
  readonly secondHtml: string;
  readonly catalog: ReadonlyMap<string, LegacySortRecord>;
}

export interface LegacyHtmlEquivalenceResult {
  readonly equivalent: boolean;
  readonly tiePermutationCount: number;
  readonly boundarySelectionVariances: readonly RankedPrefixBoundaryTieVarianceEvidence[];
  readonly reason?: string;
}

const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const childrenOf = (node: HtmlNode): readonly HtmlNode[] => "childNodes" in node ? node.childNodes : [];
const elementChildrenOf = (node: HtmlNode): readonly HtmlElement[] => childrenOf(node).filter(isElement);
const attributeOf = (element: HtmlElement, name: string): string | undefined =>
  element.attrs.find((attribute) => attribute.name === name)?.value;
const hasAttribute = (element: HtmlElement, name: string): boolean => attributeOf(element, name) !== undefined;
const classNamesOf = (element: HtmlElement): readonly string[] => (attributeOf(element, "class") ?? "").split(/\s+/u).filter(Boolean);
const textOf = (node: HtmlNode): string => {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  return childrenOf(node).map(textOf).join("");
};
const locationOf = (element: HtmlElement): SourceLocation | undefined =>
  (element.sourceCodeLocation as SourceLocation | null | undefined) ?? undefined;
const innerRangeOf = (element: HtmlElement): Readonly<{ start: number; end: number }> | undefined => {
  const location = locationOf(element);
  if (!location?.startTag || !location.endTag) return undefined;
  return { start: location.startTag.endOffset, end: location.endTag.startOffset };
};

const visitElements = (node: HtmlNode, callback: (element: HtmlElement) => void): void => {
  if (isElement(node)) callback(node);
  for (const child of childrenOf(node)) visitElements(child, callback);
};

const descendantElements = (node: HtmlNode, predicate: (element: HtmlElement) => boolean): HtmlElement[] => {
  const result: HtmlElement[] = [];
  visitElements(node, (element) => {
    if (predicate(element)) result.push(element);
  });
  return result;
};

const contentRoutePattern = /^\/(blog|notes|projects|tools)\/([^?#]+?)\/?$/u;
const routeIdentityFromElement = (element: HtmlElement): string | undefined => {
  const routes = new Set<string>();
  for (const anchor of descendantElements(element, (candidate) => candidate.tagName === "a")) {
    const href = attributeOf(anchor, "href");
    if (!href) continue;
    const match = contentRoutePattern.exec(href);
    if (!match?.[1] || !match[2]) continue;
    routes.add(`/${match[1]}/${match[2].replace(/\/$/u, "")}/`);
  }
  return routes.size === 1 ? [...routes][0] : undefined;
};

const collectionOfRoute = (route: string): ContentCollection | undefined =>
  contentRoutePattern.exec(route)?.[1] as ContentCollection | undefined;

const compareNumberTuple = (left: readonly number[], right: readonly number[]): number => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
};

const relatedScore = (current: LegacySortRecord, candidate: LegacySortRecord): number => {
  const currentTags = new Set(current.tags);
  const sharedTags = candidate.tags.filter((tag) => currentTags.has(tag)).length;
  return sharedTags * 4 + (current.category && current.category === candidate.category ? 2 : 0);
};

const sortKeyFor = (
  kind: RegionDescriptor["kind"],
  record: LegacySortRecord,
  current?: LegacySortRecord,
): readonly number[] => {
  if (kind === "related") {
    if (!current) throw new Error("Related sequence requires current content record");
    return [-relatedScore(current, record), -record.pubDateMs];
  }
  if (kind === "featured") return [record.featuredOrder ?? Number.MAX_SAFE_INTEGER, -record.pubDateMs];
  return [-record.pubDateMs];
};

const ensureSortedByDeclaredKey = (
  identities: readonly string[],
  kind: RegionDescriptor["kind"],
  catalog: ReadonlyMap<string, LegacySortRecord>,
  current?: LegacySortRecord,
): string | undefined => {
  for (let index = 1; index < identities.length; index += 1) {
    const left = catalog.get(identities[index - 1]!);
    const right = catalog.get(identities[index]!);
    if (!left || !right) return `Missing sort catalog record for ${!left ? identities[index - 1] : identities[index]}`;
    if (compareNumberTuple(sortKeyFor(kind, left, current), sortKeyFor(kind, right, current)) > 0) {
      return `${kind} sequence crosses unequal declared sort keys: ${identities[index - 1]} -> ${identities[index]}`;
    }
  }
  return undefined;
};

const sameStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const a = [...left].sort(compareCanonicalKeys);
  const b = [...right].sort(compareCanonicalKeys);
  return a.every((value, index) => value === b[index]);
};

const countChangedTieGroups = (
  first: readonly string[],
  second: readonly string[],
  kind: RegionDescriptor["kind"],
  catalog: ReadonlyMap<string, LegacySortRecord>,
  current?: LegacySortRecord,
): number => {
  const groups = new Map<string, { first: string[]; second: string[] }>();
  const keyForIdentity = (identity: string): string => {
    const record = catalog.get(identity);
    if (!record) throw new Error(`Missing sort catalog record for ${identity}`);
    return JSON.stringify(sortKeyFor(kind, record, current));
  };
  for (const identity of first) {
    const key = keyForIdentity(identity);
    const group = groups.get(key) ?? { first: [], second: [] };
    group.first.push(identity);
    groups.set(key, group);
  }
  for (const identity of second) {
    const key = keyForIdentity(identity);
    const group = groups.get(key) ?? { first: [], second: [] };
    group.second.push(identity);
    groups.set(key, group);
  }
  let count = 0;
  for (const group of groups.values()) {
    if (!sameStringSet(group.first, group.second)) throw new Error("Tie group membership differs");
    if (group.first.join("\0") !== group.second.join("\0")) count += 1;
  }
  return count;
};

const canonicalIdentityOrder = (
  identities: readonly string[],
  kind: RegionDescriptor["kind"],
  catalog: ReadonlyMap<string, LegacySortRecord>,
  current?: LegacySortRecord,
): string[] => [...identities].sort((leftIdentity, rightIdentity) => {
  const left = catalog.get(leftIdentity);
  const right = catalog.get(rightIdentity);
  if (!left || !right) return compareCanonicalKeys(leftIdentity, rightIdentity);
  const keyComparison = compareNumberTuple(sortKeyFor(kind, left, current), sortKeyFor(kind, right, current));
  return keyComparison !== 0 ? keyComparison : compareCanonicalKeys(leftIdentity, rightIdentity);
});

const domPathPart = (element: HtmlElement, childIndex: number): string => `${element.tagName}[${childIndex}]`;
const isRelatedAncestor = (ancestors: readonly HtmlElement[]): boolean => ancestors.some((ancestor) =>
  ancestor.tagName === "section" && descendantElements(ancestor, (candidate) => candidate.tagName === "h2")
    .some((heading) => textOf(heading).trim() === "関連記事"),
);

const extractSequenceDescriptor = (
  element: HtmlElement,
  source: string,
  key: string,
  ancestors: readonly HtmlElement[],
): SequenceDescriptor | undefined => {
  const range = innerRangeOf(element);
  if (!range) return undefined;
  const children = elementChildrenOf(element);
  if (children.length < 2) return undefined;
  const identities = children.map(routeIdentityFromElement);
  if (identities.some((identity) => identity === undefined)) return undefined;
  const resolved = identities as string[];
  if (new Set(resolved).size !== resolved.length) return undefined;
  const collections = new Set(resolved.map(collectionOfRoute));
  if (collections.size !== 1 || collections.has(undefined)) return undefined;
  const kind: SequenceDescriptor["kind"] = isRelatedAncestor(ancestors) && collections.has("blog") ? "related" : "published";
  const materials = new Map<string, string>();
  const gaps: string[] = [];
  let cursor = range.start;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    const location = locationOf(child);
    if (!location) return undefined;
    if (location.startOffset < cursor || location.endOffset > range.end) return undefined;
    gaps.push(source.slice(cursor, location.startOffset));
    materials.set(resolved[index]!, source.slice(location.startOffset, location.endOffset));
    cursor = location.endOffset;
  }
  gaps.push(source.slice(cursor, range.end));
  return { key, kind, startOffset: range.start, endOffset: range.end, identities: resolved, materials, gaps };
};

const structuralNode = (node: HtmlNode): unknown => {
  if (node.nodeName === "#text" && "value" in node) return ["text", node.value];
  if (node.nodeName === "#comment" && "data" in node) return ["comment", node.data];
  if (!isElement(node)) return [node.nodeName, childrenOf(node).map(structuralNode)];
  const attrs = node.attrs
    .filter((attribute) => {
      if (node.tagName === "article" && hasAttribute(node, "data-carousel-slide") && ["aria-hidden", "data-current"].includes(attribute.name)) return false;
      if (node.tagName === "img" && attribute.name === "loading") return false;
      return true;
    })
    .map((attribute) => [attribute.name, attribute.value]);
  return ["element", node.tagName, attrs, childrenOf(node).map(structuralNode)];
};

const replaceRanges = (
  source: string,
  replacements: readonly Readonly<{ start: number; end: number; replacement: string }>[],
): string => {
  let output = source;
  for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, replacement.start)}${replacement.replacement}${output.slice(replacement.end)}`;
  }
  return output;
};

const extractFeaturedDescriptor = (root: HtmlElement, source: string, key: string): FeaturedDescriptor | undefined => {
  if (!hasAttribute(root, "data-featured-carousel")) return undefined;
  const rootRange = innerRangeOf(root);
  if (!rootRange) return undefined;
  const tracks = descendantElements(root, (candidate) => hasAttribute(candidate, "data-carousel-track"));
  const dotContainers = descendantElements(root, (candidate) => classNamesOf(candidate).includes("featured-carousel-dots"));
  if (tracks.length !== 1 || dotContainers.length !== 1) return undefined;
  const track = tracks[0]!;
  const dots = dotContainers[0]!;
  const trackRange = innerRangeOf(track);
  const dotsRange = innerRangeOf(dots);
  if (!trackRange || !dotsRange) return undefined;
  const slides = elementChildrenOf(track).filter((candidate) => hasAttribute(candidate, "data-carousel-slide"));
  if (slides.length === 0 || slides.length !== elementChildrenOf(track).length) return undefined;
  const slideIdentities = slides.map(routeIdentityFromElement);
  if (slideIdentities.some((identity) => identity === undefined)) return undefined;
  const resolved = slideIdentities as string[];
  if (!resolved.every((identity) => collectionOfRoute(identity) === "projects")) return undefined;
  const itemCount = slides.length === 1 ? 1 : (slides.length % 3 === 0 ? slides.length / 3 : 0);
  if (itemCount === 0) return undefined;
  const baseIdentities = resolved.slice(0, itemCount);
  if (new Set(baseIdentities).size !== baseIdentities.length) return undefined;
  for (let copy = 0; copy < (slides.length === 1 ? 1 : 3); copy += 1) {
    const chunk = resolved.slice(copy * itemCount, (copy + 1) * itemCount);
    if (chunk.join("\0") !== baseIdentities.join("\0")) return undefined;
  }
  const currentIndex = slides.length === 1 ? 0 : itemCount;
  const materials = new Map<string, string>();
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index]!;
    const expectedCurrent = index === currentIndex;
    if (attributeOf(slide, "aria-hidden") !== (expectedCurrent ? "false" : "true")) return undefined;
    if (attributeOf(slide, "data-current") !== (expectedCurrent ? "true" : "false")) return undefined;
    for (const image of descendantElements(slide, (candidate) => candidate.tagName === "img")) {
      if (attributeOf(image, "loading") !== (expectedCurrent ? "eager" : "lazy")) return undefined;
    }
    const identity = resolved[index]!;
    const signature = fingerprint(structuralNode(slide));
    const existing = materials.get(identity);
    if (existing !== undefined && existing !== signature) return undefined;
    materials.set(identity, signature);
  }
  const buttons = elementChildrenOf(dots).filter((candidate) => candidate.tagName === "button");
  if (buttons.length !== itemCount || buttons.length !== elementChildrenOf(dots).length) return undefined;
  for (let index = 0; index < buttons.length; index += 1) {
    const titleLinks = descendantElements(slides[index]!, (candidate) =>
      candidate.tagName === "a" && classNamesOf(candidate).includes("featured-carousel-title-link"),
    );
    if (titleLinks.length !== 1) return undefined;
    const title = textOf(titleLinks[0]!).trim();
    if (attributeOf(buttons[index]!, "aria-label") !== `${title} を表示`) return undefined;
    if (attributeOf(buttons[index]!, "aria-selected") !== (index === 0 ? "true" : "false")) return undefined;
  }
  const skeleton = replaceRanges(source.slice(rootRange.start, rootRange.end), [
    { start: trackRange.start - rootRange.start, end: trackRange.end - rootRange.start, replacement: "<!--xpotato-featured-track-->" },
    { start: dotsRange.start - rootRange.start, end: dotsRange.end - rootRange.start, replacement: "<!--xpotato-featured-dots-->" },
  ]);
  return { key, kind: "featured", startOffset: rootRange.start, endOffset: rootRange.end, baseIdentities, materials, skeleton };
};

const collectRegions = (source: string): ReadonlyMap<string, RegionDescriptor> => {
  const document = parse(source, { sourceCodeLocationInfo: true }) as HtmlNode;
  const regions = new Map<string, RegionDescriptor>();
  const walk = (node: HtmlNode, path: string, ancestors: readonly HtmlElement[]): void => {
    const children = elementChildrenOf(node);
    for (let index = 0; index < children.length; index += 1) {
      const element = children[index]!;
      const childPath = `${path}/${domPathPart(element, index)}`;
      const featured = extractFeaturedDescriptor(element, source, childPath);
      if (featured) {
        regions.set(childPath, featured);
        continue;
      }
      const sequence = extractSequenceDescriptor(element, source, childPath, ancestors);
      if (sequence) {
        regions.set(childPath, sequence);
        continue;
      }
      walk(element, childPath, [...ancestors, element]);
    }
  };
  walk(document, "", []);
  return regions;
};

const currentRecordForPath = (path: string, catalog: ReadonlyMap<string, LegacySortRecord>): LegacySortRecord | undefined => {
  const endpoint = normalizeBuiltFileToEndpoint(path);
  return endpoint ? catalog.get(endpoint) : undefined;
};

const proveSequence = (
  path: string,
  first: SequenceDescriptor,
  second: SequenceDescriptor,
  catalog: ReadonlyMap<string, LegacySortRecord>,
  current?: LegacySortRecord,
): RegionProof => {
  if (first.kind !== second.kind) throw new Error(`Sequence kind mismatch at ${first.key}`);
  if (first.gaps.length !== second.gaps.length || first.gaps.some((gap, index) => gap !== second.gaps[index])) {
    throw new Error(`Sequence non-item bytes differ at ${first.key}`);
  }
  if (!sameStringSet(first.identities, second.identities)) {
    const boundaryProof = proveRankedPrefixBoundaryTie({
      path,
      regionKey: first.key,
      kind: first.kind,
      firstIdentities: first.identities,
      secondIdentities: second.identities,
      firstMaterials: first.materials,
      secondMaterials: second.materials,
      gaps: first.gaps,
      catalog,
      ...(first.kind === "related" && current !== undefined ? { current } : {}),
    });
    if (!boundaryProof) throw new Error(`Sequence membership differs at ${first.key}`);
    return {
      canonicalToken: boundaryProof.canonicalToken,
      tiePermutationCount: 0,
      boundarySelectionVariances: [boundaryProof.evidence],
    };
  }
  for (const identity of first.identities) {
    if (first.materials.get(identity) !== second.materials.get(identity)) throw new Error(`Rendered item bytes differ for ${identity} at ${first.key}`);
  }
  const firstSortError = ensureSortedByDeclaredKey(first.identities, first.kind, catalog, current);
  const secondSortError = ensureSortedByDeclaredKey(second.identities, second.kind, catalog, current);
  if (firstSortError || secondSortError) throw new Error(firstSortError ?? secondSortError!);
  const tiePermutationCount = countChangedTieGroups(first.identities, second.identities, first.kind, catalog, current);
  const canonicalOrder = canonicalIdentityOrder(first.identities, first.kind, catalog, current);
  return {
    canonicalToken: `<!--xpotato-equivalent:${fingerprint({ kind: first.kind, gaps: first.gaps, items: canonicalOrder.map((identity) => [identity, first.materials.get(identity)]) })}-->`,
    tiePermutationCount,
    boundarySelectionVariances: [],
  };
};

const proveFeatured = (
  first: FeaturedDescriptor,
  second: FeaturedDescriptor,
  catalog: ReadonlyMap<string, LegacySortRecord>,
): RegionProof => {
  if (!sameStringSet(first.baseIdentities, second.baseIdentities)) throw new Error(`Featured membership differs at ${first.key}`);
  if (first.skeleton !== second.skeleton) throw new Error(`Featured non-sequence shell differs at ${first.key}`);
  for (const identity of first.baseIdentities) {
    if (first.materials.get(identity) !== second.materials.get(identity)) throw new Error(`Featured rendered material differs for ${identity} at ${first.key}`);
  }
  const firstSortError = ensureSortedByDeclaredKey(first.baseIdentities, "featured", catalog);
  const secondSortError = ensureSortedByDeclaredKey(second.baseIdentities, "featured", catalog);
  if (firstSortError || secondSortError) throw new Error(firstSortError ?? secondSortError!);
  const tiePermutationCount = countChangedTieGroups(first.baseIdentities, second.baseIdentities, "featured", catalog);
  const canonicalOrder = canonicalIdentityOrder(first.baseIdentities, "featured", catalog);
  return {
    canonicalToken: `<!--xpotato-featured-equivalent:${fingerprint({ skeleton: first.skeleton, items: canonicalOrder.map((identity) => [identity, first.materials.get(identity)]) })}-->`,
    tiePermutationCount,
    boundarySelectionVariances: [],
  };
};

export const compareLegacyHtmlEquivalence = (input: LegacyBuildEquivalenceInput): LegacyHtmlEquivalenceResult => {
  if (input.firstHtml === input.secondHtml) return { equivalent: true, tiePermutationCount: 0, boundarySelectionVariances: [] };
  const firstRegions = collectRegions(input.firstHtml);
  const secondRegions = collectRegions(input.secondHtml);
  const firstKeys = [...firstRegions.keys()].sort(compareCanonicalKeys);
  const secondKeys = [...secondRegions.keys()].sort(compareCanonicalKeys);
  if (firstKeys.join("\0") !== secondKeys.join("\0")) {
    return { equivalent: false, tiePermutationCount: 0, boundarySelectionVariances: [], reason: `Recognized sequence regions differ for ${input.path}` };
  }
  const current = currentRecordForPath(input.path, input.catalog);
  const firstReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  const secondReplacements: Array<{ start: number; end: number; replacement: string }> = [];
  let tiePermutationCount = 0;
  const boundarySelectionVariances: RankedPrefixBoundaryTieVarianceEvidence[] = [];
  try {
    for (const key of firstKeys) {
      const first = firstRegions.get(key)!;
      const second = secondRegions.get(key)!;
      const proof = first.kind === "featured" && second.kind === "featured"
        ? proveFeatured(first, second, input.catalog)
        : first.kind !== "featured" && second.kind !== "featured"
          ? proveSequence(input.path, first, second, input.catalog, first.kind === "related" ? current : undefined)
          : (() => { throw new Error(`Sequence kind mismatch at ${key}`); })();
      tiePermutationCount += proof.tiePermutationCount;
      boundarySelectionVariances.push(...proof.boundarySelectionVariances);
      firstReplacements.push({ start: first.startOffset, end: first.endOffset, replacement: proof.canonicalToken });
      secondReplacements.push({ start: second.startOffset, end: second.endOffset, replacement: proof.canonicalToken });
    }
  } catch (error) {
    return { equivalent: false, tiePermutationCount: 0, boundarySelectionVariances: [], reason: error instanceof Error ? error.message : String(error) };
  }
  const canonicalFirst = replaceRanges(input.firstHtml, firstReplacements);
  const canonicalSecond = replaceRanges(input.secondHtml, secondReplacements);
  if (canonicalFirst !== canonicalSecond) return { equivalent: false, tiePermutationCount: 0, boundarySelectionVariances: [], reason: `Unrecognized HTML variance remains for ${input.path}` };
  if (tiePermutationCount === 0 && boundarySelectionVariances.length === 0) return { equivalent: false, tiePermutationCount: 0, boundarySelectionVariances: [], reason: `HTML bytes differ without a proven permitted equivalence class for ${input.path}` };
  return { equivalent: true, tiePermutationCount, boundarySelectionVariances };
};

export const compareLegacyBuildEquivalence = (input: Readonly<{
  first: LegacyHtmlBuild;
  second: LegacyHtmlBuild;
  expectedEndpointPathsSha256: string;
  catalog: ReadonlyMap<string, LegacySortRecord>;
  source: LegacyBuildSourceIdentity;
  nodeVersion: string;
  npmVersion: string;
}>): LegacyBuildReproductionEvidence => {
  const observations: readonly LegacyBuildObservation[] = [input.first.manifest, input.second.manifest].map((manifest) => ({
    rawDistManifestSha256: manifest.distManifestSha256,
    fileCount: manifest.fileCount,
    endpointPathsSha256: manifest.endpointPathsSha256,
    nonHtmlManifestSha256: manifest.nonHtmlManifestSha256,
  }));
  const fail = (reason: string, differingPaths: readonly string[]): LegacyBuildReproductionEvidence => ({
    schemaVersion: 1,
    equivalenceProfileId: LEGACY_BUILD_EQUIVALENCE_PROFILE_ID,
    source: input.source,
    toolchain: { nodeVersion: input.nodeVersion, npmVersion: input.npmVersion, buildCommands: ["npm ci", "npm run check", "npm run build"] },
    builds: observations,
    permittedBoundarySelectionVariances: [],
    result: { status: "FAIL", equivalenceVerified: false, reason, differingPaths: [...differingPaths].sort(compareCanonicalKeys) },
  });
  if (input.first.manifest.endpointPathsSha256 !== input.second.manifest.endpointPathsSha256) return fail("Legacy endpoint sets differ between clean builds", []);
  if (input.second.manifest.endpointPathsSha256 !== input.expectedEndpointPathsSha256) return fail("Legacy endpoint set differs from deterministic inventory", []);
  if (input.first.manifest.nonHtmlManifestSha256 !== input.second.manifest.nonHtmlManifestSha256) {
    const firstByPath = new Map(input.first.manifest.files.map((item) => [item.path, item]));
    const secondByPath = new Map(input.second.manifest.files.map((item) => [item.path, item]));
    const paths = [...new Set([...firstByPath.keys(), ...secondByPath.keys()])].filter((path) => {
      if (path.endsWith(".html")) return false;
      const left = firstByPath.get(path);
      const right = secondByPath.get(path);
      return left?.sha256 !== right?.sha256 || left?.sizeBytes !== right?.sizeBytes;
    });
    return fail("Non-HTML artifacts are not byte-identical", paths);
  }
  const firstByPath = new Map(input.first.manifest.files.map((item) => [item.path, item]));
  const secondByPath = new Map(input.second.manifest.files.map((item) => [item.path, item]));
  const allPaths = [...new Set([...firstByPath.keys(), ...secondByPath.keys()])].sort(compareCanonicalKeys);
  const differingPaths = allPaths.filter((path) => {
    const left = firstByPath.get(path);
    const right = secondByPath.get(path);
    return left?.sha256 !== right?.sha256 || left?.sizeBytes !== right?.sizeBytes;
  });
  if (differingPaths.some((path) => !path.endsWith(".html"))) return fail("Unexpected non-HTML difference", differingPaths);
  let permittedTiePermutationCount = 0;
  const permittedBoundarySelectionVariances: RankedPrefixBoundaryTieVarianceEvidence[] = [];
  for (const path of differingPaths) {
    const firstHtml = input.first.html.get(path);
    const secondHtml = input.second.html.get(path);
    if (firstHtml === undefined || secondHtml === undefined) return fail(`Missing HTML evidence for ${path}`, differingPaths);
    const result = compareLegacyHtmlEquivalence({ path, firstHtml, secondHtml, catalog: input.catalog });
    if (!result.equivalent) return fail(result.reason ?? `HTML equivalence failed for ${path}`, differingPaths);
    permittedTiePermutationCount += result.tiePermutationCount;
    permittedBoundarySelectionVariances.push(...result.boundarySelectionVariances);
  }
  return {
    schemaVersion: 1,
    equivalenceProfileId: LEGACY_BUILD_EQUIVALENCE_PROFILE_ID,
    source: input.source,
    toolchain: { nodeVersion: input.nodeVersion, npmVersion: input.npmVersion, buildCommands: ["npm ci", "npm run check", "npm run build"] },
    builds: observations,
    permittedBoundarySelectionVariances,
    result: {
      status: "PASS",
      rawByteIdentical: differingPaths.length === 0,
      equivalenceVerified: true,
      differingHtmlPaths: differingPaths,
      permittedTiePermutationCount,
    },
  };
};

const isHex = (value: unknown, length: number): value is string => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);

export const validateLegacyBuildReproductionEvidence = (candidate: unknown): readonly string[] => {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return ["reproduction evidence must be an object"];
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.equivalenceProfileId !== LEGACY_BUILD_EQUIVALENCE_PROFILE_ID) errors.push("equivalenceProfileId mismatch");
  const source = value.source as Record<string, unknown> | undefined;
  if (!source || typeof source !== "object") errors.push("source identity missing");
  else {
    for (const field of ["tagObjectSha", "commitSha", "packageLockBlobSha"] as const) if (!isHex(source[field], 40)) errors.push(`source.${field} must be a 40-hex Git object ID`);
    for (const field of ["repository", "tag"] as const) if (typeof source[field] !== "string" || source[field] === "") errors.push(`source.${field} missing`);
  }
  const builds = value.builds;
  if (!Array.isArray(builds) || builds.length < 2) errors.push("at least two build observations required");
  else for (const [index, build] of builds.entries()) {
    if (build === null || typeof build !== "object" || Array.isArray(build)) {
      errors.push(`builds.${index} must be an object`);
      continue;
    }
    const record = build as Record<string, unknown>;
    for (const field of ["rawDistManifestSha256", "endpointPathsSha256", "nonHtmlManifestSha256"] as const) if (!isHex(record[field], 64)) errors.push(`builds.${index}.${field} must be SHA-256`);
    if (!Number.isInteger(record.fileCount) || Number(record.fileCount) < 0) errors.push(`builds.${index}.fileCount invalid`);
  }
  const boundaryVariances = value.permittedBoundarySelectionVariances;
  if (!Array.isArray(boundaryVariances)) errors.push("permittedBoundarySelectionVariances must be an array");
  else for (const [index, boundaryVariance] of boundaryVariances.entries()) {
    for (const error of validateRankedPrefixBoundaryTieVarianceEvidence(boundaryVariance)) errors.push(`permittedBoundarySelectionVariances.${index}: ${error}`);
  }
  const result = value.result as Record<string, unknown> | undefined;
  if (!result || typeof result !== "object") errors.push("result missing");
  else if (result.status === "PASS") {
    if (result.equivalenceVerified !== true) errors.push("PASS requires equivalenceVerified=true");
    if (typeof result.rawByteIdentical !== "boolean") errors.push("PASS rawByteIdentical missing");
    if (!Array.isArray(result.differingHtmlPaths)) errors.push("PASS differingHtmlPaths missing");
    if (!Number.isInteger(result.permittedTiePermutationCount) || Number(result.permittedTiePermutationCount) < 0) errors.push("PASS permittedTiePermutationCount invalid");
  } else if (result.status === "FAIL") {
    if (result.equivalenceVerified !== false) errors.push("FAIL requires equivalenceVerified=false");
    if (typeof result.reason !== "string" || result.reason === "") errors.push("FAIL reason missing");
    if (!Array.isArray(result.differingPaths)) errors.push("FAIL differingPaths missing");
  } else errors.push("result.status must be PASS or FAIL");
  return errors;
};
