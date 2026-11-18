import {
  categoryRecordSchema,
  noteSubjectRecordSchema,
  tagRecordSchema,
  taxonomyRegistrySchema,
  toolCategoryRecordSchema,
  type TaxonomyRegistry,
} from "@xpotato/content-contracts/content";
import {
  contentCollectionSchema,
  contentIdSchema,
  slugSchema,
  type ContentCollection,
} from "@xpotato/content-contracts/common";
import { seriesRegistrySchema, type SeriesRegistry } from "@xpotato/content-contracts/series";
import type { TaxonomySnapshot } from "./draft.js";

export const taxonomyRegistryPath = "content/registry/taxonomy/terms.json";
export const seriesRegistryPath = "content/registry/series/series.json";
export const editorContentIndexPath = "content/registry/editor-content-index.json";
export const taxonomyNamespaces = [
  "blogCategories",
  "noteSubjects",
  "toolCategories",
  "tags",
] as const;
export type TaxonomyNamespace = (typeof taxonomyNamespaces)[number];
export type TagKind = "technology" | "topic" | "purpose";
export interface TaxonomyAddition {
  namespace: TaxonomyNamespace;
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  kind?: TagKind;
}
/** The API accepts editorial operations, never an arbitrary repository path or JSON patch. */
export interface EditorRegistryChanges {
  taxonomy?: TaxonomyAddition[];
  series?: SeriesRegistry;
  /** Registry the author actually saw before editing; never infer it from the latest head. */
  seriesBase?: SeriesRegistry;
}
export interface EditorContentRecord {
  contentId: string;
  path: string;
  title: string;
  collection: ContentCollection;
}
export interface EditorContentIndex {
  schemaVersion: 1;
  documents: EditorContentRecord[];
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("REGISTRY_CHANGE_INVALID");
  if (Object.keys(value).some((key) => !keys.includes(key))) throw Error("REGISTRY_CHANGE_INVALID");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, optional = false): string | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error("REGISTRY_CHANGE_INVALID");
  return value.trim();
}
export function parseTaxonomyAddition(value: unknown): TaxonomyAddition {
  const item = record(value, ["namespace", "id", "label", "description", "aliases", "kind"]);
  if (!taxonomyNamespaces.includes(item.namespace as TaxonomyNamespace))
    throw Error("REGISTRY_CHANGE_INVALID");
  const id = slugSchema.parse(item.id);
  const label = text(item.label, 120)!;
  const description = text(item.description, 1000, true);
  if (item.aliases !== undefined && (!Array.isArray(item.aliases) || item.aliases.length > 20))
    throw Error("REGISTRY_CHANGE_INVALID");
  const aliases = (item.aliases as unknown[] | undefined)?.map((alias) => text(alias, 120)!);
  if (item.namespace === "tags") {
    if (!["technology", "topic", "purpose"].includes(item.kind as string))
      throw Error("TAG_KIND_REQUIRED");
  } else if (item.kind !== undefined) throw Error("REGISTRY_CHANGE_INVALID");
  return {
    namespace: item.namespace as TaxonomyNamespace,
    id,
    label,
    ...(description === undefined ? {} : { description }),
    ...(aliases === undefined ? {} : { aliases }),
    ...(item.kind === undefined ? {} : { kind: item.kind as TagKind }),
  };
}
export function parseRegistryChanges(value: unknown): EditorRegistryChanges {
  const changes = record(value, ["taxonomy", "series", "seriesBase"]);
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 192 * 1024)
    throw Error("REGISTRY_CHANGE_TOO_LARGE");
  if (
    changes.taxonomy !== undefined &&
    (!Array.isArray(changes.taxonomy) || changes.taxonomy.length > 50)
  )
    throw Error("REGISTRY_CHANGE_INVALID");
  if (changes.series !== undefined && changes.seriesBase === undefined)
    throw Error("SERIES_BASE_REQUIRED");
  if (changes.series === undefined && changes.seriesBase !== undefined)
    throw Error("REGISTRY_CHANGE_INVALID");
  return {
    ...(changes.seriesBase === undefined
      ? {}
      : { seriesBase: seriesRegistrySchema.parse(changes.seriesBase) }),
    ...(changes.taxonomy === undefined
      ? {}
      : { taxonomy: (changes.taxonomy as unknown[]).map(parseTaxonomyAddition) }),
    ...(changes.series === undefined ? {} : { series: seriesRegistrySchema.parse(changes.series) }),
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja");
}
export function applyTaxonomyAdditions(
  registry: TaxonomyRegistry,
  additions: readonly TaxonomyAddition[],
): TaxonomyRegistry {
  const next = structuredClone(taxonomyRegistrySchema.parse(registry));
  for (const raw of additions) {
    const addition = parseTaxonomyAddition(raw);
    const entries = next[addition.namespace];
    if (entries.some((entry) => entry.id === addition.id || entry.slug === addition.id))
      throw Error("TAXONOMY_ID_EXISTS: " + addition.id);
    const names = [addition.label, ...(addition.aliases ?? [])].map(normalize);
    if (new Set(names).size !== names.length) throw Error("TAXONOMY_ALIAS_DUPLICATE");
    if (
      entries.some((entry) =>
        [entry.label, ...entry.aliases].some((name) => names.includes(normalize(name))),
      )
    )
      throw Error("TAXONOMY_TERM_EXISTS: " + addition.label);
    const common = {
      id: addition.id,
      label: addition.label,
      description: addition.description ?? addition.label,
      slug: addition.id,
      indexable: false,
      aliases: addition.aliases ?? [],
      status: "active" as const,
    };
    switch (addition.namespace) {
      case "blogCategories":
        next.blogCategories.push(categoryRecordSchema.parse(common));
        break;
      case "noteSubjects":
        next.noteSubjects.push(noteSubjectRecordSchema.parse({ ...common, archive: true }));
        break;
      case "toolCategories":
        next.toolCategories.push(toolCategoryRecordSchema.parse(common));
        break;
      case "tags":
        next.tags.push(tagRecordSchema.parse({ ...common, kind: addition.kind, archive: true }));
        break;
    }
  }
  return taxonomyRegistrySchema.parse(next);
}

export function taxonomySnapshotFields(registry: TaxonomyRegistry) {
  const active = (entries: readonly { id: string; status: string }[]) =>
    entries.filter((item) => item.status === "active").map((item) => item.id);
  const labels: Record<string, string> = {};
  for (const namespace of taxonomyNamespaces)
    for (const term of registry[namespace]) labels[term.id] = term.label;
  return {
    categories: {
      blog: active(registry.blogCategories),
      notes: active(registry.noteSubjects),
      tools: active(registry.toolCategories),
      projects: [],
      pages: [],
    },
    tags: active(registry.tags),
    labels,
    terms: registry,
  };
}
/** Apply local operations to selectors and validation before the atomic Git save. */
export function previewRegistryChanges(
  snapshot: TaxonomySnapshot,
  changes?: EditorRegistryChanges,
): TaxonomySnapshot {
  let next = snapshot;
  if (changes?.taxonomy?.length) {
    if (!snapshot.terms) throw Error("EDITOR_TAXONOMY_UNAVAILABLE");
    next = {
      ...next,
      ...taxonomySnapshotFields(applyTaxonomyAdditions(snapshot.terms, changes.taxonomy)),
    };
  }
  if (changes?.series)
    next = { ...next, seriesRegistry: seriesRegistrySchema.parse(changes.series) };
  return next;
}
const sameSeries = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
/** Merge only independent series edits. Concurrent edits to the same series need an explicit review. */
export function rebaseSeriesChanges(
  changes: EditorRegistryChanges,
  currentRegistry: SeriesRegistry,
): EditorRegistryChanges {
  if (!changes.series) return changes;
  if (!changes.seriesBase) throw Error("SERIES_BASE_REQUIRED");
  const base = seriesRegistrySchema.parse(changes.seriesBase);
  const local = seriesRegistrySchema.parse(changes.series);
  const remote = seriesRegistrySchema.parse(currentRegistry);
  const baseById = new Map(base.series.map((series) => [series.id, series]));
  const localById = new Map(local.series.map((series) => [series.id, series]));
  const remoteById = new Map(remote.series.map((series) => [series.id, series]));
  const merged = new Map(remoteById);
  for (const id of new Set([...baseById.keys(), ...localById.keys()])) {
    const before = baseById.get(id),
      after = localById.get(id),
      current = remoteById.get(id);
    if (sameSeries(before, after) || sameSeries(after, current)) continue;
    if (!sameSeries(before, current)) throw Error("SERIES_CONFLICT");
    if (after) merged.set(id, after);
    else merged.delete(id);
  }
  const result = seriesRegistrySchema.safeParse({ schemaVersion: 1, series: [...merged.values()] });
  if (!result.success) throw Error("SERIES_CONFLICT");
  return { ...changes, series: result.data, seriesBase: remote };
}
/** A submitted operation is removed only if its current local value still matches. */
export function remainingRegistryChanges(
  current?: EditorRegistryChanges,
  submitted?: EditorRegistryChanges,
): EditorRegistryChanges | undefined {
  if (!current) return undefined;
  const sent = new Set((submitted?.taxonomy ?? []).map((item) => JSON.stringify(item)));
  const taxonomy = current.taxonomy?.filter((item) => !sent.has(JSON.stringify(item)));
  // The save may have incorporated remote series while the user continued editing locally.
  // Reapply those independent remote changes, then use our committed candidate as the next base.
  const reconciled =
    current.series && submitted?.seriesBase
      ? rebaseSeriesChanges(current, submitted.seriesBase)
      : current;
  const series =
    reconciled.series && !sameSeries(reconciled.series, submitted?.series)
      ? reconciled.series
      : undefined;
  const seriesBase = submitted?.series ?? reconciled.seriesBase;
  return taxonomy?.length || series
    ? {
        ...(taxonomy?.length ? { taxonomy } : {}),
        ...(series ? { series, ...(seriesBase ? { seriesBase } : {}) } : {}),
      }
    : undefined;
}
export function parseEditorContentIndex(value: unknown): EditorContentIndex {
  const index = record(value, ["schemaVersion", "documents"]);
  if (
    index.schemaVersion !== 1 ||
    !Array.isArray(index.documents) ||
    index.documents.length > 10000
  )
    throw Error("EDITOR_CONTENT_INDEX_INVALID");
  const seenIds = new Set<string>(),
    seenPaths = new Set<string>();
  const directories: Record<ContentCollection, string> = {
    blog: "articles",
    notes: "notes",
    projects: "projects",
    tools: "tools",
    pages: "pages",
  };
  const documents = index.documents.map((raw): EditorContentRecord => {
    const item = record(raw, ["contentId", "path", "title", "collection"]);
    const contentId = contentIdSchema.parse(item.contentId),
      collection = contentCollectionSchema.parse(item.collection);
    if (
      typeof item.path !== "string" ||
      !new RegExp("^content/" + directories[collection] + "/[a-z0-9][a-z0-9_-]*\\.mdx?$").test(
        item.path,
      )
    )
      throw Error("EDITOR_CONTENT_INDEX_INVALID");
    const title = text(item.title, 1000)!;
    if (seenIds.has(contentId) || seenPaths.has(item.path))
      throw Error("EDITOR_CONTENT_INDEX_DUPLICATE");
    seenIds.add(contentId);
    seenPaths.add(item.path);
    return { contentId, path: item.path, title, collection };
  });
  return { schemaVersion: 1, documents };
}
export function updateEditorContentIndex(
  index: EditorContentIndex,
  entry: EditorContentRecord,
): EditorContentIndex {
  const previous = index.documents.find(
    (item) => item.contentId === entry.contentId || item.path === entry.path,
  );
  if (previous && (previous.contentId !== entry.contentId || previous.path !== entry.path))
    throw Error("CONTENT_ID_PATH_CONFLICT");
  return parseEditorContentIndex({
    schemaVersion: 1,
    documents: [
      ...index.documents.filter((item) => item.contentId !== entry.contentId),
      entry,
    ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  });
}
