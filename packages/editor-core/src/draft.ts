import { parseDocument, stringify, type Document } from "yaml";
import { articleUrlId } from "@xpotato/content-contracts/article-route";
import { contentIdSchema, type ContentCollection } from "@xpotato/content-contracts/common";
import {
  blogSourceFrontmatterSchema,
  noteSourceFrontmatterSchema,
  projectSourceFrontmatterSchema,
  toolSourceFrontmatterSchema,
  pageSourceFrontmatterSchema,
} from "@xpotato/content-contracts/content";
import { validatePortableMdx } from "@xpotato/portable-content";
import type { TaxonomyRegistry } from "@xpotato/content-contracts/content";
import type { SeriesRegistry } from "@xpotato/content-contracts/series";
import type { EditorContentRecord } from "./registry.js";
export const collectionDirectories = Object.freeze({
  blog: "articles",
  notes: "notes",
  projects: "projects",
  tools: "tools",
  pages: "pages",
});
export const draftByteLimit = 512 * 1024;
export interface DraftMetadata {
  id: string;
  title: string;
  description: string;
  draft: boolean;
  category?: string | undefined;
  subject?: string | undefined;
  tags?: string[] | undefined;
  pubDate?: string | undefined;
  updatedDate?: string | undefined;
  [key: string]: unknown;
}
export interface ParsedDraft {
  data: DraftMetadata;
  body: string;
  header: string;
  newline: string;
  source: string;
}
export interface TaxonomySnapshot {
  contractVersion: 1;
  categories: Record<string, string[]>;
  tags: string[];
  modules: string[];
  labels?: Record<string, string>;
  terms?: TaxonomyRegistry;
  seriesRegistry?: SeriesRegistry;
  contentIndex?: EditorContentRecord[];
}
export function parseDraft(source: string): ParsedDraft {
  if (new TextEncoder().encode(source).byteLength > draftByteLimit) throw Error("DRAFT_TOO_LARGE");
  const match = /^(?:\uFEFF)?---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
  if (!match) throw Error("FRONTMATTER_REQUIRED");
  const doc = parseDocument(match[2]!, { uniqueKeys: true });
  if (doc.errors.length) throw Error("FRONTMATTER_INVALID");
  const data = doc.toJS({ maxAliasCount: 0 }) as DraftMetadata;
  if (!data || Array.isArray(data) || typeof data !== "object") throw Error("FRONTMATTER_INVALID");
  contentIdSchema.parse(data.id);
  return {
    data,
    body: source.slice(match[0].length),
    header: match[2]!,
    newline: match[1]!,
    source,
  };
}
/** Compare only plain metadata values; unfamiliar objects must take the normal serialization path. */
function sameMetadataValue(left: unknown, right: unknown, depth = 0): boolean {
  if (Object.is(left, right)) return true;
  if (depth > 100) return false;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameMetadataValue(value, right[index], depth + 1))
    );
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const plain = (value: object) =>
    Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!plain(left) || !plain(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameMetadataValue(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
          depth + 1,
        ),
    )
  );
}
export function updateDraft(source: string, fields: Partial<DraftMetadata>, body?: string): string {
  const parsed = parseDraft(source);
  if (Object.hasOwn(fields, "id") && fields.id !== parsed.data.id)
    throw Error("CONTENT_ID_IMMUTABLE");
  const changed = Object.entries(fields).filter(([key, value]) =>
    value === undefined
      ? Object.hasOwn(parsed.data, key)
      : !Object.hasOwn(parsed.data, key) || !sameMetadataValue(parsed.data[key], value),
  );
  if (!changed.length) {
    if (body === undefined || body === parsed.body) return source;
    // Keep comments, quotes, whitespace, BOM, and the original delimiter/newline bytes intact.
    return source.slice(0, source.length - parsed.body.length) + body;
  }
  const doc = parseDocument(parsed.header, { uniqueKeys: true });
  for (const [key, value] of changed) value === undefined ? doc.delete(key) : doc.set(key, value);
  const header = doc.toString({ lineWidth: 0 }).replace(/\r?\n$/u, "");
  return (
    "---" +
    parsed.newline +
    header.replace(/\r?\n/gu, parsed.newline) +
    parsed.newline +
    "---" +
    parsed.newline +
    (body ?? parsed.body)
  );
}
export function createDraft(title: string, category: string, id = crypto.randomUUID()): string {
  return createDraftForCollection({ collection: "blog", title, category, id });
}
export interface CreateDraftOptions {
  collection: ContentCollection;
  title?: string;
  category?: string | undefined;
  subject?: string | undefined;
  id?: string;
  education?: boolean;
}
export function createDraftForCollection(options: CreateDraftOptions): string {
  const { collection, id = crypto.randomUUID() } = options;
  contentIdSchema.parse(id);
  const labels = {
    blog: "記事",
    notes: "メモ",
    projects: "プロダクト",
    tools: "ツール",
    pages: "固定ページ",
  };
  const data = {
    id,
    title:
      options.title?.trim() || "無題の" + (options.education ? "教育記事" : labels[collection]),
    description: "",
    ...(collection === "blog" ? { category: options.category ?? "software" } : {}),
    ...(collection === "notes" ? { subject: options.subject ?? "everyday" } : {}),
    ...(collection === "tools" ? { category: options.category ?? "calculation" } : {}),
    ...(collection === "projects" ? { status: "planned" } : {}),
    ...(collection === "pages" ? {} : { tags: [] }),
    ...((collection === "blog" || collection === "notes") && options.education
      ? { education: { subject: "" } }
      : {}),
    draft: true,
  };
  return "---\n" + stringify(data, { lineWidth: 0 }) + "---\n\n";
}
/** Files do not carry a collection field; ambiguous category-based articles need a chosen destination. */
export function inferDraftCollection(data: DraftMetadata): ContentCollection | null {
  if (data.subject !== undefined) return "notes";
  if (
    data.status !== undefined ||
    data.sourceAvailability !== undefined ||
    data.stack !== undefined
  )
    return "projects";
  if (data.category !== undefined) return null;
  if (data.tags === undefined && data.pubDate === undefined) return "pages";
  return null;
}
export function validateDraft(
  source: string,
  collection: ContentCollection,
  taxonomy?: TaxonomySnapshot,
): string[] {
  try {
    const { data, body } = parseDraft(source);
    const schemas = {
      blog: blogSourceFrontmatterSchema,
      notes: noteSourceFrontmatterSchema,
      projects: projectSourceFrontmatterSchema,
      tools: toolSourceFrontmatterSchema,
      pages: pageSourceFrontmatterSchema,
    };
    const parsed = schemas[collection].safeParse(data);
    const errors = parsed.success
      ? []
      : parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message);
    errors.push(...validatePortableMdx(body));
    if (taxonomy) {
      if (taxonomy.contractVersion !== 1) errors.push("EDITOR_CONTRACT_VERSION_UNSUPPORTED");
      const category = collection === "notes" ? data.subject : data.category;
      if (category && !(taxonomy.categories[collection] ?? []).includes(category))
        errors.push("CATEGORY_UNKNOWN");
      for (const tag of data.tags ?? [])
        if (!taxonomy.tags.includes(tag)) errors.push("TAG_UNKNOWN: " + tag);
      if (collection === "projects" && Array.isArray(data.stack)) {
        const technologies = new Set(
          taxonomy.terms?.tags
            .filter((term) => term.status === "active" && term.kind === "technology")
            .map((term) => term.id) ?? taxonomy.tags,
        );
        for (const tag of data.stack)
          if (typeof tag !== "string" || !technologies.has(tag))
            errors.push("PROJECT_STACK_UNKNOWN: " + String(tag));
      }
    }
    return errors;
  } catch (e) {
    return [e instanceof Error ? e.message : "DRAFT_INVALID"];
  }
}
export function draftPath(id: string, collection: ContentCollection = "blog"): string {
  return "content/" + collectionDirectories[collection] + "/" + articleUrlId(id) + ".mdx";
}
export function assertEditablePath(value: string): void {
  if (!/^content\/(articles|notes|projects|tools|pages)\/[a-z0-9][a-z0-9_-]*\.mdx?$/u.test(value))
    throw Error("CONTENT_PATH_NOT_ALLOWED");
}
export function collectionFromPath(value: string): ContentCollection {
  assertEditablePath(value);
  const directory = value.split("/")[1]!;
  return (Object.keys(collectionDirectories) as ContentCollection[]).find(
    (k) => collectionDirectories[k] === directory,
  )!;
}
export function documentHandoff(source: string, commit: string, sourcePath: string) {
  const { data } = parseDraft(source);
  assertEditablePath(sourcePath);
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw Error("COMMIT_REQUIRED");
  return {
    schemaVersion: 1 as const,
    contentId: data.id,
    sourcePath,
    commit,
    bodySource: "git" as const,
    publicationAuthorized: false as const,
  };
}
