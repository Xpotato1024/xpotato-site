import { taxonomyRegistrySchema } from "@xpotato/content-contracts/content";
import { seriesRegistrySchema } from "@xpotato/content-contracts/series";
import { validateSeriesReferences } from "@xpotato/portable-content/series";
import { contentIdSchema } from "@xpotato/content-contracts/common";
import {
  assertEditablePath,
  collectionFromPath,
  parseDraft,
  validateDraft,
  type TaxonomySnapshot,
} from "./draft.js";
import {
  applyTaxonomyAdditions,
  editorContentIndexPath,
  parseEditorContentIndex,
  rebaseSeriesChanges,
  seriesRegistryPath,
  taxonomyNamespaces,
  taxonomyRegistryPath,
  taxonomySnapshotFields,
  updateEditorContentIndex,
  type TaxonomyAddition,
  type EditorContentRecord,
} from "./registry.js";

export const branchManifestPath = "content/registry/editor.json";
export interface BranchFile {
  mode: string;
  type: string;
  sha: string;
}
export type BranchTree = ReadonlyMap<string, BranchFile>;
export interface DraftBranchIdentity {
  branch: string;
  expectedHead: string;
  path: string;
  contentId: string;
}
export interface DraftBranchConflict {
  path: string;
  reason: string;
}
export interface DraftBranchState {
  branch: string;
  head: string;
  main: string;
  ancestor: string;
  behind: number;
  status: "current" | "ready" | "synced" | "conflict";
  conflicts: DraftBranchConflict[];
}
export interface DraftBranchSyncResult extends DraftBranchState {
  /** Only returned for an applied synchronization, with the new committed context. */
  manifest?: TaxonomySnapshot;
  previousHead?: string;
}
export interface DraftBranchRevision {
  tree: BranchTree;
  read(path: string): Promise<string>;
}
export interface DraftBranchPlan {
  writes: { path: string; source: string }[];
  copies: { path: string; sha: string }[];
  manifest: TaxonomySnapshot;
}
export class DraftBranchConflictError extends Error {
  constructor(readonly conflicts: DraftBranchConflict[]) {
    super("DRAFT_MAIN_CONFLICT");
  }
}
function fail(path: string, reason: string): never {
  throw new DraftBranchConflictError([{ path, reason }]);
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v !== null && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, value]) => [k, canonical(value)]),
        )
      : v;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const sameFile = (a: BranchFile | undefined, b: BranchFile | undefined) =>
  a?.sha === b?.sha && a?.mode === b?.mode && a?.type === b?.type;
const regular = (f: BranchFile | undefined) => f?.type === "blob" && f.mode === "100644";
export function changedBranchPaths(base: BranchTree, head: BranchTree): string[] {
  return [...new Set([...base.keys(), ...head.keys()])]
    .filter((path) => !sameFile(base.get(path), head.get(path)))
    .sort();
}
function relatedReadme(path: string): string[] {
  const stem = path
    .split("/")
    .at(-1)!
    .replace(/\.mdx?$/u, "");
  return ["docs/content/" + stem + "/README.md", "docs/content/" + stem + "-product/README.md"];
}
export function draftScopePaths(path: string): Set<string> {
  assertEditablePath(path);
  return new Set([
    path,
    editorContentIndexPath,
    taxonomyRegistryPath,
    branchManifestPath,
    seriesRegistryPath,
    ...relatedReadme(path),
  ]);
}
function checkModes(revision: DraftBranchRevision, path: string) {
  const f = revision.tree.get(path);
  if (f && !regular(f)) fail(path, "NON_REGULAR_FILE");
}
async function optionalSource(revision: DraftBranchRevision, path: string) {
  checkModes(revision, path);
  return revision.tree.has(path) ? await revision.read(path) : undefined;
}
async function requiredJson(revision: DraftBranchRevision, path: string) {
  const s = await optionalSource(revision, path);
  if (s === undefined) fail(path, "REGISTRY_MISSING");
  try {
    return JSON.parse(s);
  } catch {
    fail(path, "REGISTRY_INVALID");
  }
}
function indexRow(path: string, source: string): EditorContentRecord {
  const { data } = parseDraft(source);
  return {
    contentId: data.id,
    path,
    title: data.title,
    collection: collectionFromPath(path),
    draft: data.draft === true,
    education: Boolean(data.education),
  };
}

/** Only the draft article, exact derived index, additive related taxonomy and its own
 * series membership may diverge. All other main changes are inherited byte-for-byte. */
export async function planDraftBranch(
  input: DraftBranchIdentity,
  ancestor: DraftBranchRevision,
  head: DraftBranchRevision,
  main: DraftBranchRevision,
): Promise<DraftBranchPlan> {
  const path = input.path,
    id = contentIdSchema.parse(input.contentId),
    collection = collectionFromPath(path);
  const allowed = draftScopePaths(path);
  for (const p of changedBranchPaths(ancestor.tree, head.tree)) {
    if (!allowed.has(p)) fail(p, "OUTSIDE_ARTICLE_SCOPE");
    checkModes(ancestor, p);
    checkModes(head, p);
    if (!head.tree.has(p)) fail(p, "DRAFT_DELETION_OR_RENAME");
  }
  const [oldSource, source, mainSource] = await Promise.all([
    optionalSource(ancestor, path),
    optionalSource(head, path),
    optionalSource(main, path),
  ]);
  if (source === undefined && oldSource !== undefined) fail(path, "DRAFT_DELETION_OR_RENAME");
  for (const value of [oldSource, source, mainSource]) {
    if (value !== undefined && parseDraft(value).data.id !== id)
      fail(path, "CONTENT_ID_PATH_CONFLICT");
  }
  if (source !== oldSource && (source === undefined || parseDraft(source).data.draft !== true))
    fail(path, "DRAFT_ONLY");
  // A published source unchanged on the branch (before its first save) also must
  // not be silently replaced beneath unsaved local editing.
  if (mainSource !== oldSource && mainSource !== source) fail(path, "SAME_ARTICLE_CHANGED");
  const readIndex = async (r: DraftBranchRevision) =>
    parseEditorContentIndex(await requiredJson(r, editorContentIndexPath));
  const [aIndex, hIndex, mIndex] = await Promise.all([
    readIndex(ancestor),
    readIndex(head),
    readIndex(main),
  ]);
  const rowMatches = (index: typeof aIndex, value: string | undefined) => {
    const rows = index.documents.filter((r) => r.path === path || r.contentId === id);
    if (value === undefined) return rows.length === 0;
    return rows.length === 1 && equal(rows[0], indexRow(path, value));
  };
  if (
    !rowMatches(aIndex, oldSource) ||
    !rowMatches(hIndex, source) ||
    !rowMatches(mIndex, mainSource)
  )
    fail(editorContentIndexPath, "CONTENT_ID_PATH_CONFLICT_OR_STALE_INDEX");
  const expected =
    source === undefined ? aIndex : updateEditorContentIndex(aIndex, indexRow(path, source));
  if (!equal(expected, hIndex))
    fail(editorContentIndexPath, "UNRELATED_OR_NON_DERIVED_INDEX_CHANGE");
  const index =
    source === undefined ? mIndex : updateEditorContentIndex(mIndex, indexRow(path, source));
  const readTerms = async (r: DraftBranchRevision) =>
    taxonomyRegistrySchema.parse(await requiredJson(r, taxonomyRegistryPath));
  const [aTerms, hTerms, mTerms] = await Promise.all([
    readTerms(ancestor),
    readTerms(head),
    readTerms(main),
  ]);
  const readManifest = async (r: DraftBranchRevision) =>
    (await requiredJson(r, branchManifestPath)) as TaxonomySnapshot;
  const [aManifest, hManifest, mManifest] = await Promise.all([
    readManifest(ancestor),
    readManifest(head),
    readManifest(main),
  ]);
  if (
    !equal(aManifest.terms, aTerms) ||
    !equal(hManifest.terms, hTerms) ||
    !equal(mManifest.terms, mTerms)
  )
    fail(branchManifestPath, "MANIFEST_STALE");
  for (const [snapshot, terms] of [
    [aManifest, aTerms],
    [hManifest, hTerms],
    [mManifest, mTerms],
  ] as const) {
    if (
      snapshot.contractVersion !== 1 ||
      !Array.isArray(snapshot.modules) ||
      !equal({ ...snapshot, ...taxonomySnapshotFields(terms) }, snapshot)
    )
      fail(branchManifestPath, "MANIFEST_STALE");
  }
  if (!equal({ ...aManifest, ...taxonomySnapshotFields(hTerms) }, hManifest))
    fail(branchManifestPath, "UNRELATED_CONTRACT_CHANGE");
  const additions: TaxonomyAddition[] = [];
  const data = source === undefined ? undefined : parseDraft(source).data;
  for (const namespace of taxonomyNamespaces) {
    const old = aTerms[namespace],
      next = hTerms[namespace];
    if (!equal(next.slice(0, old.length), old))
      fail(taxonomyRegistryPath, "EXISTING_TAXONOMY_CHANGED");
    for (const item of next.slice(old.length)) {
      const related =
        namespace === "tags"
          ? (data?.tags ?? []).includes(item.id) ||
            (Array.isArray(data?.stack) && data.stack.includes(item.id))
          : namespace === "blogCategories"
            ? collection === "blog" && data?.category === item.id
            : namespace === "noteSubjects"
              ? collection === "notes" && data?.subject === item.id
              : collection === "tools" && data?.category === item.id;
      if (!related) fail(taxonomyRegistryPath, "UNRELATED_TAXONOMY_CHANGE");
      const addition: TaxonomyAddition = {
        namespace,
        id: item.id,
        label: item.label,
        ...(item.description === undefined ? {} : { description: item.description }),
        aliases: item.aliases,
        ...("kind" in item ? { kind: item.kind } : {}),
      };
      additions.push(addition);
    }
  }
  if (additions.length > 50 || !equal(applyTaxonomyAdditions(aTerms, additions), hTerms))
    fail(taxonomyRegistryPath, "NON_CANONICAL_TAXONOMY_CHANGE");
  let terms = mTerms;
  for (const addition of additions) {
    const existing = terms[addition.namespace].find((t) => t.id === addition.id);
    if (existing) {
      const intended = hTerms[addition.namespace].find((t) => t.id === addition.id);
      if (!equal(existing, intended)) fail(taxonomyRegistryPath, "TAXONOMY_ID_CONFLICT");
      continue;
    }
    try {
      terms = applyTaxonomyAdditions(terms, [addition]);
    } catch {
      fail(taxonomyRegistryPath, "TAXONOMY_NAME_CONFLICT");
    }
  }
  const readSeries = async (r: DraftBranchRevision) =>
    seriesRegistrySchema.parse(await requiredJson(r, seriesRegistryPath));
  const [aSeries, hSeries, mSeries] = await Promise.all([
    readSeries(ancestor),
    readSeries(head),
    readSeries(main),
  ]);
  const strip = (s: (typeof aSeries.series)[number]) => ({
    ...s,
    entries: s.entries.filter((e) => e.contentId !== id),
  });
  const retained = hSeries.series.filter((s) => aSeries.series.some((a) => a.id === s.id));
  if (!equal(aSeries.series.map(strip), retained.map(strip)))
    fail(seriesRegistryPath, "UNRELATED_SERIES_CHANGE");
  for (const s of hSeries.series.filter((s) => !aSeries.series.some((a) => a.id === s.id))) {
    if (s.entries.length !== 1 || s.entries[0]?.contentId !== id)
      fail(seriesRegistryPath, "UNRELATED_NEW_SERIES");
  }
  let series = mSeries;
  try {
    series = rebaseSeriesChanges({ seriesBase: aSeries, series: hSeries }, mSeries).series!;
  } catch {
    fail(seriesRegistryPath, "SERIES_CONFLICT");
  }
  if (
    validateSeriesReferences(
      series,
      index.documents.map((r) => r.contentId),
    ).length
  )
    fail(seriesRegistryPath, "SERIES_REFERENCE_INVALID");
  const manifest = {
    ...mManifest,
    ...taxonomySnapshotFields(terms),
    contentIndex: index.documents,
    seriesRegistry: series,
  };
  if (source !== undefined && validateDraft(source, collection, manifest).length)
    fail(path, "DRAFT_CONTRACT_CHANGED");
  const writes: DraftBranchPlan["writes"] = [];
  const copies: DraftBranchPlan["copies"] = [];
  if (!equal(index, mIndex)) writes.push({ path: editorContentIndexPath, source: json(index) });
  if (!equal(terms, mTerms)) {
    writes.push({ path: taxonomyRegistryPath, source: json(terms) });
    const { contentIndex: _index, seriesRegistry: _series, ...publicManifest } = manifest;
    writes.push({ path: branchManifestPath, source: json(publicManifest) });
  }
  if (!equal(series, mSeries)) writes.push({ path: seriesRegistryPath, source: json(series) });
  for (const p of [path, ...relatedReadme(path)]) {
    if (
      head.tree.has(p) &&
      [...main.tree.keys()].some((q) => q.startsWith(p + "/") || p.startsWith(q + "/"))
    )
      fail(p, "PATH_TYPE_CONFLICT");
    if (sameFile(ancestor.tree.get(p), head.tree.get(p))) continue;
    if (
      !sameFile(ancestor.tree.get(p), main.tree.get(p)) &&
      !sameFile(main.tree.get(p), head.tree.get(p))
    )
      fail(p, "BOTH_SIDES_CHANGED");
    const file = head.tree.get(p);
    if (file && !sameFile(file, main.tree.get(p))) copies.push({ path: p, sha: file.sha });
  }
  return { writes, copies, manifest };
}
