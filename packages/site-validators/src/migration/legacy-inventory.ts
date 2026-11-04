import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  legacyFreezeBaselineSchema,
  migrationInventorySchema,
  type LegacyContentRecord,
  type LegacyFreezeBaseline,
  type LegacyHtmlRecord,
  type LegacyInteractiveRecord,
  type LegacyMediaRecord,
  type LegacyTaxonomyRecord,
  type MigrationInventory,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";

export const LEGACY_REPOSITORY = "Xpotato1024/xpotato-site";
export const LEGACY_TAG = "legacy-pre-vnext-2026-08-28";
export const LEGACY_COMMIT = "927d105713561309fc5e2374396f86646b5aeb2a";
export const LEGACY_INVENTORY_GENERATOR_VERSION = "1.0.0";
export const LEGACY_HASH_RULE_VERSION = "legacy-source-bytes-v1" as const;

export const DESIGN_TIME_BASELINE = Object.freeze({
  publishedContentCounts: Object.freeze({ blog: 44, projects: 6, notes: 1, tools: 1, pages: 1 }),
  gitMediaBytes: 4_559_586,
  wordpressQueryIdentityCount: 3,
  interactiveRecordCount: 1,
});

type LegacyCollection = LegacyContentRecord["collection"];
type LegacyRouteRecord = MigrationInventory["routes"][number];

interface ParsedLegacyContent {
  readonly record: LegacyContentRecord;
  readonly data: Readonly<Record<string, unknown>>;
  readonly body: string;
  readonly recoveredRawHtml: readonly string[];
  readonly legacyHtml?: LegacyHtmlRecord;
  readonly interactive: readonly LegacyInteractiveRecord[];
}

interface GitSnapshotReader {
  readonly repositoryRoot: string;
  readonly commitSha: string;
  listFiles(pathspec: string): readonly string[];
  readBlob(repositoryPath: string): Buffer;
  readText(repositoryPath: string): string;
}

const gitBuffer = (repositoryRoot: string, args: readonly string[]): Buffer =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });

const gitText = (repositoryRoot: string, args: readonly string[]): string =>
  gitBuffer(repositoryRoot, args).toString("utf8").trimEnd();

const createGitSnapshotReader = (repositoryRoot: string, commitSha: string): GitSnapshotReader => ({
  repositoryRoot,
  commitSha,
  listFiles(pathspec) {
    return gitBuffer(repositoryRoot, ["ls-tree", "-r", "-z", "--name-only", commitSha, "--", pathspec])
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .sort(compareCanonicalKeys);
  },
  readBlob(repositoryPath) {
    return gitBuffer(repositoryRoot, ["cat-file", "blob", `${commitSha}:${repositoryPath}`]);
  },
  readText(repositoryPath) {
    return this.readBlob(repositoryPath).toString("utf8");
  },
});

const sortStrings = (values: Iterable<string>): string[] => [...values].sort(compareCanonicalKeys);

const ensureRecord = (value: unknown, context: string): Readonly<Record<string, unknown>> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context}: frontmatter must be a mapping`);
  }
  return value as Readonly<Record<string, unknown>>;
};

const contentCollections = ["blog", "notes", "projects", "tools", "pages"] as const;

const collectionFromPath = (repositoryPath: string): LegacyCollection => {
  const match = /^src\/content\/(blog|notes|projects|tools|pages)\/(.+)\.mdx?$/u.exec(repositoryPath);
  if (!match?.[1]) throw new Error(`Unsupported legacy content path: ${repositoryPath}`);
  return match[1] as LegacyCollection;
};

const legacyContentIdFromPath = (repositoryPath: string): string => {
  const match = /^src\/content\/(blog|notes|projects|tools|pages)\/(.+)\.mdx?$/u.exec(repositoryPath);
  if (!match?.[1] || !match[2]) throw new Error(`Unsupported legacy content path: ${repositoryPath}`);
  return `${match[1]}:${match[2]}`;
};

interface SourceSegments {
  readonly frontmatterSource: string;
  readonly bodySource: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export const splitLegacyContentSource = (sourceBytes: Uint8Array, repositoryPath: string): SourceSegments => {
  const source = Buffer.from(sourceBytes).toString("utf8");
  if (!Buffer.from(source, "utf8").equals(Buffer.from(sourceBytes))) {
    throw new Error(`${repositoryPath}: content is not valid canonical UTF-8`);
  }
  const match = /^(?:\uFEFF)?---\r?\n(?<frontmatter>[\s\S]*?\r?\n)---(?:\r?\n|$)/u.exec(source);
  const frontmatterSource = match?.groups?.frontmatter;
  if (!match || frontmatterSource === undefined) throw new Error(`${repositoryPath}: exact frontmatter block missing`);
  const bodySource = source.slice(match[0].length);
  const data = ensureRecord(parseYaml(frontmatterSource), repositoryPath);
  return { frontmatterSource, bodySource, data };
};

const decodeHex = (value: string, context: string): string => {
  const codePoint = Number.parseInt(value, 16);
  if (!Number.isFinite(codePoint) || codePoint > 0x10ffff) throw new Error(`${context}: invalid Unicode escape`);
  return String.fromCodePoint(codePoint);
};

export const decodeStaticJavascriptString = (literal: string): string => {
  const quote = literal[0];
  if (!quote || !["\"", "'", "`"].includes(quote) || literal.at(-1) !== quote) {
    throw new Error("Static HTML expression is not a complete string literal");
  }
  const body = literal.slice(1, -1);
  if (quote === "`" && body.includes("${")) throw new Error("Template literal substitutions are not static");
  let result = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]!;
    if (character !== "\\") {
      result += character;
      continue;
    }
    index += 1;
    const escaped = body[index];
    if (escaped === undefined) throw new Error("Trailing escape in static HTML literal");
    const simpleEscapes: Readonly<Record<string, string>> = {
      "0": "\0",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      "\\": "\\",
      "\"": "\"",
      "'": "'",
      "`": "`",
    };
    if (escaped in simpleEscapes) {
      result += simpleEscapes[escaped]!;
      continue;
    }
    if (escaped === "\n") continue;
    if (escaped === "\r") {
      if (body[index + 1] === "\n") index += 1;
      continue;
    }
    if (escaped === "x") {
      const hex = body.slice(index + 1, index + 3);
      if (!/^[a-fA-F0-9]{2}$/u.test(hex)) throw new Error("Invalid hexadecimal escape in static HTML literal");
      result += decodeHex(hex, "static HTML literal");
      index += 2;
      continue;
    }
    if (escaped === "u") {
      if (body[index + 1] === "{") {
        const close = body.indexOf("}", index + 2);
        if (close < 0) throw new Error("Unclosed Unicode code point escape in static HTML literal");
        const hex = body.slice(index + 2, close);
        if (!/^[a-fA-F0-9]{1,6}$/u.test(hex)) throw new Error("Invalid Unicode code point escape");
        result += decodeHex(hex, "static HTML literal");
        index = close;
      } else {
        const hex = body.slice(index + 1, index + 5);
        if (!/^[a-fA-F0-9]{4}$/u.test(hex)) throw new Error("Invalid Unicode escape in static HTML literal");
        result += decodeHex(hex, "static HTML literal");
        index += 4;
      }
      continue;
    }
    result += escaped;
  }
  return result;
};

const staticLiteralPattern = String.raw`("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\x60(?:\\[\s\S]|[^\x60\\])*\x60)`;

const recoverLegacyHtml = (body: string, legacyContentId: string): {
  readonly record?: LegacyHtmlRecord;
  readonly rawHtml: readonly string[];
} => {
  const legacyHtmlUses = [...body.matchAll(/<LegacyHtml\b/gu)].length;
  const directSetHtmlUses = [...body.matchAll(/\bset:html\s*=/gu)].length;
  const totalUses = legacyHtmlUses + directSetHtmlUses;
  if (totalUses === 0) return { rawHtml: [] };

  const literals: string[] = [];
  const componentPattern = new RegExp(String.raw`<LegacyHtml\b[\s\S]*?\bhtml\s*=\s*\{\s*${staticLiteralPattern}\s*\}[\s\S]*?\/?\s*>`, "gu");
  for (const match of body.matchAll(componentPattern)) {
    if (match[1]) literals.push(match[1]);
  }
  const directPattern = new RegExp(String.raw`\bset:html\s*=\s*\{\s*${staticLiteralPattern}\s*\}`, "gu");
  for (const match of body.matchAll(directPattern)) {
    if (match[1]) literals.push(match[1]);
  }
  if (literals.length !== totalUses) {
    return {
      record: {
        contentId: legacyContentId,
        extractionStatus: "blocked",
        blocker: "raw HTML expression is not a static string or substitution-free template literal",
        disposition: "manual_review",
      },
      rawHtml: [],
    };
  }
  if (literals.length !== 1) {
    return {
      record: {
        contentId: legacyContentId,
        extractionStatus: "blocked",
        blocker: "multiple raw HTML expressions require explicit per-expression review",
        disposition: "manual_review",
      },
      rawHtml: [],
    };
  }
  try {
    const rawHtml = decodeStaticJavascriptString(literals[0]!);
    return {
      record: {
        contentId: legacyContentId,
        extractionStatus: "static",
        rawHtmlSha256: sha256(Buffer.from(rawHtml, "utf8")),
        disposition: "manual_review",
      },
      rawHtml: [rawHtml],
    };
  } catch (error) {
    return {
      record: {
        contentId: legacyContentId,
        extractionStatus: "blocked",
        blocker: error instanceof Error ? error.message : String(error),
        disposition: "manual_review",
      },
      rawHtml: [],
    };
  }
};

const extractHtmlImageLocators = (source: string): string[] => {
  const result: string[] = [];
  for (const match of source.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/giu)) {
    const value = match[1] ?? match[2];
    if (value) result.push(value);
  }
  return result;
};

const extractMarkdownImageLocators = (source: string): string[] => {
  const result: string[] = [];
  for (const match of source.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)]+))/gu)) {
    const value = match[1] ?? match[2];
    if (value) result.push(value);
  }
  return result;
};

const extractAstroMediaLocators = (source: string): string[] => {
  const result: string[] = [];
  for (const match of source.matchAll(/<AssetImage\b[\s\S]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["']([^"']+)["']\s*\})[\s\S]*?>/gu)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value) result.push(value);
  }
  return result;
};

const mediaFrontmatterFields = ["heroImage", "ogImage", "coverImage", "overviewImage", "previewImage"] as const;

const extractMediaLocators = (
  data: Readonly<Record<string, unknown>>,
  body: string,
  recoveredRawHtml: readonly string[],
): string[] => {
  const values: string[] = [];
  for (const field of mediaFrontmatterFields) {
    const value = data[field];
    if (typeof value === "string" && value.length > 0) values.push(value);
  }
  values.push(...extractMarkdownImageLocators(body), ...extractHtmlImageLocators(body), ...extractAstroMediaLocators(body));
  for (const html of recoveredRawHtml) values.push(...extractHtmlImageLocators(html));
  return sortStrings(new Set(values));
};

export const extractLegacyMediaLocators = (sourceBytes: Uint8Array, repositoryPath: string): readonly string[] => {
  const { data, bodySource } = splitLegacyContentSource(sourceBytes, repositoryPath);
  const recovered = recoverLegacyHtml(bodySource, legacyContentIdFromPath(repositoryPath));
  return extractMediaLocators(data, bodySource, recovered.rawHtml);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const resolveComponentPath = (contentPath: string, importPath: string, treePaths: ReadonlySet<string>): string | undefined => {
  if (!importPath.startsWith(".")) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(contentPath), importPath));
  const candidates = extname(base)
    ? [base]
    : [base, ...[".tsx", ".jsx", ".ts", ".js", ".astro"].map((extension) => `${base}${extension}`)];
  return candidates.find((candidate) => treePaths.has(candidate));
};

const extractInteractiveRecords = (
  contentPath: string,
  legacyContentId: string,
  body: string,
  reader: GitSnapshotReader,
  treePaths: ReadonlySet<string>,
): LegacyInteractiveRecord[] => {
  const result: LegacyInteractiveRecord[] = [];
  const importPattern = /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["'];?\s*$/gmu;
  for (const match of body.matchAll(importPattern)) {
    const identifier = match[1];
    const importPath = match[2];
    if (!identifier || !importPath) continue;
    const usePattern = new RegExp(String.raw`<${escapeRegex(identifier)}\b[^>]*\b(client:(?:load|idle|visible|media|only))\b[^>]*>`, "gu");
    const uses = [...body.matchAll(usePattern)];
    if (uses.length === 0) continue;
    const componentPath = resolveComponentPath(contentPath, importPath, treePaths);
    if (!componentPath) throw new Error(`${contentPath}: hydrated component import cannot be resolved: ${importPath}`);
    const directives = new Set(uses.map((item) => item[1]).filter((item): item is string => item !== undefined));
    if (directives.size !== 1) throw new Error(`${contentPath}: hydrated component uses inconsistent directives`);
    const componentSource = reader.readText(componentPath);
    const framework = /from\s+["']react["']/u.test(componentSource) || /\.tsx$/u.test(componentPath) ? "React" : "unknown";
    result.push({
      componentPath,
      usedByContentIds: [legacyContentId],
      framework,
      hydrationDirective: [...directives][0]!,
    });
  }
  return result.sort((left, right) => compareCanonicalKeys(left.componentPath, right.componentPath));
};

const parseLegacyContent = (
  repositoryPath: string,
  sourceBytes: Uint8Array,
  reader: GitSnapshotReader,
  treePaths: ReadonlySet<string>,
): ParsedLegacyContent => {
  const collection = collectionFromPath(repositoryPath);
  const legacyContentId = legacyContentIdFromPath(repositoryPath);
  const { frontmatterSource, bodySource, data } = splitLegacyContentSource(sourceBytes, repositoryPath);
  const title = data.title;
  if (typeof title !== "string" || title.length === 0) throw new Error(`${repositoryPath}: title missing`);
  const recovered = recoverLegacyHtml(bodySource, legacyContentId);
  const interactive = extractInteractiveRecords(repositoryPath, legacyContentId, bodySource, reader, treePaths);
  const record: LegacyContentRecord = {
    collection,
    legacyPath: repositoryPath,
    legacyContentId,
    title,
    draft: data.draft === true,
    bodySha256: sha256(Buffer.from(bodySource, "utf8")),
    frontmatterSha256: sha256(Buffer.from(frontmatterSource, "utf8")),
    referencedMediaPaths: extractMediaLocators(data, bodySource, recovered.rawHtml),
    referencedInteractiveComponents: interactive.map((item) => item.componentPath),
  };
  return {
    record,
    data,
    body: bodySource,
    recoveredRawHtml: recovered.rawHtml,
    ...(recovered.record ? { legacyHtml: recovered.record } : {}),
    interactive,
  };
};

const rawStringValues = (value: unknown): readonly string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return [];
};

const createTaxonomyRecords = (contents: readonly ParsedLegacyContent[]): LegacyTaxonomyRecord[] => {
  const usages = new Map<string, { namespace: string; rawValue: string; contentIds: Set<string> }>();
  const add = (namespace: string, rawValue: string, contentId: string): void => {
    const key = `${namespace}\0${rawValue}`;
    const existing = usages.get(key) ?? { namespace, rawValue, contentIds: new Set<string>() };
    existing.contentIds.add(contentId);
    usages.set(key, existing);
  };
  for (const content of contents) {
    const { collection, legacyContentId } = content.record;
    if (collection === "blog") {
      for (const value of rawStringValues(content.data.category)) add("blog_category", value, legacyContentId);
    }
    if (collection === "notes") {
      for (const value of rawStringValues(content.data.subject)) add("note_subject", value, legacyContentId);
    }
    if (collection === "projects") {
      for (const value of rawStringValues(content.data.technologies)) add("project_technology", value, legacyContentId);
    }
    if (collection === "tools") {
      for (const value of rawStringValues(content.data.category)) add("tool_category", value, legacyContentId);
    }
    for (const value of rawStringValues(content.data.tags)) add("tag", value, legacyContentId);
  }
  return [...usages.values()]
    .map(({ namespace, rawValue, contentIds }) => ({
      namespace,
      rawValue,
      normalizedValue: rawValue.normalize("NFKC").trim().toLowerCase(),
      usageCount: contentIds.size,
      contentIds: sortStrings(contentIds),
    }))
    .sort((left, right) => compareCanonicalKeys(`${left.namespace}\0${left.rawValue}`, `${right.namespace}\0${right.rawValue}`));
};

const infraTags = new Set([
  "ai", "anythingllm", "homelab", "migration", "qdrant", "qwen", "rag", "rerank", "self-hosted", "ssh",
  "storage", "tei", "troubleshooting", "vllm", "vps", "windows", "wsl", "wsl2",
]);
const networkTags = new Set(["conoha-vps", "dns", "network", "router", "ssh", "vpn", "webサーバー"]);
const appTags = new Set(["app", "astro", "component", "frontend", "react", "tool", "typescript", "ui", "web"]);

const legacyBlogCategory = (data: Readonly<Record<string, unknown>>): string => {
  const explicit = typeof data.category === "string" ? data.category.trim().toLowerCase() : "";
  if (["infra", "network", "app", "diary"].includes(explicit)) return explicit;
  if (explicit === "blog") return "diary";
  const tags = rawStringValues(data.tags).map((tag) => tag.trim().toLowerCase());
  if (tags.some((tag) => infraTags.has(tag))) return "infra";
  if (tags.some((tag) => networkTags.has(tag))) return "network";
  if (tags.some((tag) => appTags.has(tag))) return "app";
  return "diary";
};

const legacyToolCategory = (data: Readonly<Record<string, unknown>>): string => {
  const explicit = typeof data.category === "string" ? data.category.trim().toLowerCase() : "";
  if (["calculation", "documents", "utility"].includes(explicit)) return explicit;
  if (explicit === "math") return "calculation";
  if (["pdf", "document"].includes(explicit)) return "documents";
  return "utility";
};

const contentRoute = (content: LegacyContentRecord): string => {
  const slug = content.legacyContentId.slice(content.collection.length + 1);
  return content.collection === "pages" ? `/${slug}/` : `/${content.collection}/${slug}/`;
};

const staticPageRoute = (repositoryPath: string): string => {
  const relative = repositoryPath.replace(/^src\/pages\//u, "").replace(/\.astro$/u, "");
  if (relative === "index") return "/";
  if (relative === "404") return "/404.html";
  return relative.endsWith("/index") ? `/${relative.slice(0, -"/index".length)}/` : `/${relative}/`;
};

const createRouteRecords = (
  contents: readonly ParsedLegacyContent[],
  reader: GitSnapshotReader,
  treePaths: ReadonlySet<string>,
): LegacyRouteRecord[] => {
  const routes = new Map<string, LegacyRouteRecord>();
  const add = (record: LegacyRouteRecord): void => {
    if (routes.has(record.urlPath)) throw new Error(`Legacy route emitted more than once: ${record.urlPath}`);
    routes.set(record.urlPath, record);
  };
  for (const content of contents.filter((item) => !item.record.draft)) {
    add({
      urlPath: contentRoute(content.record),
      sourceKind: content.record.collection === "tools" ? "tool" : "content",
    });
  }
  const staticPages = [...treePaths]
    .filter((path) => path.startsWith("src/pages/") && path.endsWith(".astro") && !path.includes("["))
    .sort(compareCanonicalKeys);
  for (const page of staticPages) {
    const urlPath = staticPageRoute(page);
    const source = reader.readText(page);
    const target = /const\s+targetPath\s*=\s*["']([^"']+)["']/u.exec(source)?.[1];
    if (target && /http-equiv=["']refresh["']/u.test(source)) {
      add({ urlPath, sourceKind: "redirect", statusCode: 200, target });
    } else {
      const sourceKind = ["/blog/", "/notes/", "/projects/", "/tools/", "/pages/"].includes(urlPath)
        ? "generated_archive"
        : "static_page";
      add({ urlPath, sourceKind });
    }
  }
  const blogCategories = new Set(
    contents.filter((item) => item.record.collection === "blog" && !item.record.draft).map((item) => legacyBlogCategory(item.data)),
  );
  for (const category of sortStrings(blogCategories)) {
    add({ urlPath: `/blog/category/${category}/`, sourceKind: "generated_archive" });
  }
  const toolCategories = new Set(
    contents.filter((item) => item.record.collection === "tools" && !item.record.draft).map((item) => legacyToolCategory(item.data)),
  );
  for (const category of sortStrings(toolCategories)) {
    add({ urlPath: `/tools/category/${category}/`, sourceKind: "generated_archive" });
  }
  if (treePaths.has("public/robots.txt")) add({ urlPath: "/robots.txt", sourceKind: "static_page" });
  if (/\bsitemap\(\)/u.test(reader.readText("astro.config.mjs"))) {
    add({ urlPath: "/sitemap-0.xml", sourceKind: "static_page" });
    add({ urlPath: "/sitemap-index.xml", sourceKind: "static_page" });
  }
  for (const content of contents) {
    const legacyPath = content.data.legacyPath;
    if (typeof legacyPath === "string" && legacyPath.startsWith("/") && legacyPath.includes("?")) {
      add({ urlPath: legacyPath, sourceKind: "redirect", target: contentRoute(content.record) });
    }
  }
  return [...routes.values()].sort((left, right) => compareCanonicalKeys(left.urlPath, right.urlPath));
};

const mediaExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tif", ".tiff", ".svg"]);

const detectMediaFormat = (bytes: Buffer): string => {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (bytes.subarray(4, 8).toString("ascii") === "ftyp" && /avif|avis/u.test(bytes.subarray(8, 16).toString("ascii"))) return "avif";
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a)) return "tiff";
  if (/^\s*(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/iu.test(bytes.toString("utf8"))) return "svg";
  return "unknown";
};

const likelyMediaOrigin = (legacyPath: string): LegacyMediaRecord["likelyOrigin"] => {
  if (legacyPath.includes("/wp-content/")) return "wordpress";
  if (legacyPath.includes("/projects/")) return "project";
  if (legacyPath.includes("/tools/")) return "tool";
  if (legacyPath.includes("/ui/") || /(?:favicon|icon|logo)/iu.test(legacyPath)) return "site_asset";
  return "unknown";
};

const resolveMediaReference = (locator: string, contentPath: string, mediaPaths: ReadonlySet<string>): string | undefined => {
  if (/^(?:r2:|https?:)/iu.test(locator)) return undefined;
  const withoutSuffix = locator.split(/[?#]/u, 1)[0] ?? locator;
  const candidates = new Set<string>();
  if (withoutSuffix.startsWith("/")) candidates.add(`public${withoutSuffix}`);
  if (withoutSuffix.startsWith("public/")) candidates.add(withoutSuffix);
  candidates.add(posix.normalize(posix.join(posix.dirname(contentPath), withoutSuffix)));
  candidates.add(`public/${withoutSuffix.replace(/^\.\//u, "")}`);
  return [...candidates].find((candidate) => mediaPaths.has(candidate));
};

const createMediaRecords = (
  contents: readonly ParsedLegacyContent[],
  reader: GitSnapshotReader,
  treePaths: ReadonlySet<string>,
): LegacyMediaRecord[] => {
  const mediaPaths = new Set(
    [...treePaths].filter((path) => path.startsWith("public/") && mediaExtensions.has(extname(path).toLowerCase())),
  );
  const references = new Map<string, Set<string>>();
  const unresolved = new Map<string, { contentIds: Set<string>; reason: "non_git_locator" | "missing_git_object" }>();
  for (const content of contents) {
    for (const locator of content.record.referencedMediaPaths) {
      const resolved = resolveMediaReference(locator, content.record.legacyPath, mediaPaths);
      if (resolved) {
        const ids = references.get(resolved) ?? new Set<string>();
        ids.add(content.record.legacyContentId);
        references.set(resolved, ids);
      } else {
        const reason = /^(?:r2:|https?:)/iu.test(locator) ? "non_git_locator" : "missing_git_object";
        const entry = unresolved.get(locator) ?? { contentIds: new Set<string>(), reason };
        entry.contentIds.add(content.record.legacyContentId);
        unresolved.set(locator, entry);
      }
    }
  }
  const verified: LegacyMediaRecord[] = sortStrings(mediaPaths).map((legacyPath) => {
    const bytes = reader.readBlob(legacyPath);
    return {
      verificationStatus: "git_verified",
      legacyPath,
      sourceFileSha256: sha256(bytes),
      sizeBytes: bytes.byteLength,
      detectedFormat: detectMediaFormat(bytes),
      referencedByContentIds: sortStrings(references.get(legacyPath) ?? []),
      likelyOrigin: likelyMediaOrigin(legacyPath),
    };
  });
  const unresolvedRecords: LegacyMediaRecord[] = [...unresolved.entries()]
    .sort(([left], [right]) => compareCanonicalKeys(left, right))
    .map(([legacyPath, entry]) => ({
      verificationStatus: "unresolved_non_local",
      legacyPath,
      referencedByContentIds: sortStrings(entry.contentIds),
      likelyOrigin: likelyMediaOrigin(legacyPath),
      reason: entry.reason,
    }));
  return [...verified, ...unresolvedRecords].sort((left, right) => compareCanonicalKeys(left.legacyPath, right.legacyPath));
};

const aggregateInteractive = (contents: readonly ParsedLegacyContent[]): LegacyInteractiveRecord[] => {
  const records = new Map<string, { framework: string; hydrationDirective?: string; contentIds: Set<string> }>();
  for (const content of contents) {
    for (const interactive of content.interactive) {
      const existing = records.get(interactive.componentPath);
      if (existing && (existing.framework !== interactive.framework || existing.hydrationDirective !== interactive.hydrationDirective)) {
        throw new Error(`Interactive component metadata is inconsistent: ${interactive.componentPath}`);
      }
      const entry = existing ?? {
        framework: interactive.framework,
        ...(interactive.hydrationDirective ? { hydrationDirective: interactive.hydrationDirective } : {}),
        contentIds: new Set<string>(),
      };
      for (const contentId of interactive.usedByContentIds) entry.contentIds.add(contentId);
      records.set(interactive.componentPath, entry);
    }
  }
  return [...records.entries()]
    .sort(([left], [right]) => compareCanonicalKeys(left, right))
    .map(([componentPath, entry]) => ({
      componentPath,
      usedByContentIds: sortStrings(entry.contentIds),
      framework: entry.framework,
      ...(entry.hydrationDirective ? { hydrationDirective: entry.hydrationDirective } : {}),
    }));
};

const canonicalInventoryPayload = (inventory: Omit<MigrationInventory, "inventoryPayloadSha256"> | MigrationInventory): unknown => ({
  schemaVersion: inventory.schemaVersion,
  hashRuleVersion: inventory.hashRuleVersion,
  repository: inventory.snapshot.repository,
  commitSha: inventory.snapshot.commitSha,
  tag: inventory.snapshot.tag,
  generatorVersion: inventory.snapshot.generatorVersion,
  content: [...inventory.content]
    .map((item) => ({
      ...item,
      referencedMediaPaths: sortStrings(item.referencedMediaPaths),
      referencedInteractiveComponents: sortStrings(item.referencedInteractiveComponents),
    }))
    .sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId)),
  routes: [...inventory.routes].sort((left, right) => compareCanonicalKeys(left.urlPath, right.urlPath)),
  media: [...inventory.media]
    .map((item) => ({ ...item, referencedByContentIds: sortStrings(item.referencedByContentIds) }))
    .sort((left, right) => compareCanonicalKeys(left.legacyPath, right.legacyPath)),
  taxonomy: [...inventory.taxonomy]
    .map((item) => ({ ...item, contentIds: sortStrings(item.contentIds) }))
    .sort((left, right) => compareCanonicalKeys(`${left.namespace}\0${left.rawValue}`, `${right.namespace}\0${right.rawValue}`)),
  interactive: [...inventory.interactive]
    .map((item) => ({ ...item, usedByContentIds: sortStrings(item.usedByContentIds) }))
    .sort((left, right) => compareCanonicalKeys(left.componentPath, right.componentPath)),
  legacyHtml: [...inventory.legacyHtml].sort((left, right) => compareCanonicalKeys(left.contentId, right.contentId)),
});

export const computeInventoryPayloadSha256 = (
  inventory: Omit<MigrationInventory, "inventoryPayloadSha256"> | MigrationInventory,
): string => fingerprint(canonicalInventoryPayload(inventory));

export const generateLegacyInventory = (
  repositoryRoot: string,
  options: Readonly<{ generatedAt?: string }> = {},
): MigrationInventory => {
  const tagType = gitText(repositoryRoot, ["cat-file", "-t", `refs/tags/${LEGACY_TAG}`]);
  if (tagType !== "tag") throw new Error(`${LEGACY_TAG} must be an annotated tag object`);
  const peeledCommit = gitText(repositoryRoot, ["rev-parse", `${LEGACY_TAG}^{}`]);
  if (peeledCommit !== LEGACY_COMMIT) throw new Error(`${LEGACY_TAG} peels to ${peeledCommit}, expected ${LEGACY_COMMIT}`);
  const reader = createGitSnapshotReader(repositoryRoot, LEGACY_COMMIT);
  const treePaths = new Set([
    ...reader.listFiles("src"),
    ...reader.listFiles("public"),
    ...reader.listFiles("astro.config.mjs"),
  ]);
  const contentPaths = sortStrings(treePaths).filter((path) => /^src\/content\/(?:blog|notes|projects|tools|pages)\/.+\.mdx?$/u.test(path));
  const parsedContents = contentPaths.map((path) => parseLegacyContent(path, reader.readBlob(path), reader, treePaths));
  const content = parsedContents.map((item) => item.record);
  const routes = createRouteRecords(parsedContents, reader, treePaths);
  const media = createMediaRecords(parsedContents, reader, treePaths);
  const taxonomy = createTaxonomyRecords(parsedContents);
  const interactive = aggregateInteractive(parsedContents);
  const legacyHtml = parsedContents.flatMap((item) => item.legacyHtml ? [item.legacyHtml] : []);
  const withoutDigest: Omit<MigrationInventory, "inventoryPayloadSha256"> = {
    schemaVersion: 1,
    hashRuleVersion: LEGACY_HASH_RULE_VERSION,
    snapshot: {
      repository: LEGACY_REPOSITORY,
      commitSha: LEGACY_COMMIT,
      tag: LEGACY_TAG,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      generatorVersion: LEGACY_INVENTORY_GENERATOR_VERSION,
    },
    content,
    contentMappings: [],
    routes,
    routeParity: [],
    media,
    mediaMappings: [],
    taxonomy,
    interactive,
    legacyHtml,
  };
  const inventory = { ...withoutDigest, inventoryPayloadSha256: computeInventoryPayloadSha256(withoutDigest) };
  return migrationInventorySchema.parse(inventory);
};

const duplicateValues = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return sortStrings(duplicates);
};

const addDuplicates = (errors: string[], label: string, values: readonly string[]): void => {
  for (const duplicate of duplicateValues(values)) errors.push(`duplicate ${label}: ${duplicate}`);
};

export const validateMigrationInventoryInvariants = (candidate: unknown): readonly string[] => {
  const parsed = migrationInventorySchema.safeParse(candidate);
  if (!parsed.success) return parsed.error.issues.map((issue) => `schema ${issue.path.join(".")}: ${issue.message}`);
  const inventory = parsed.data;
  const errors: string[] = [];
  if (inventory.snapshot.repository !== LEGACY_REPOSITORY) errors.push(`snapshot repository mismatch: ${inventory.snapshot.repository}`);
  if (inventory.snapshot.commitSha !== LEGACY_COMMIT) errors.push(`snapshot commit mismatch: ${inventory.snapshot.commitSha}`);
  if (inventory.snapshot.tag !== LEGACY_TAG) errors.push(`snapshot tag mismatch: ${inventory.snapshot.tag ?? "missing"}`);
  if (inventory.snapshot.generatorVersion !== LEGACY_INVENTORY_GENERATOR_VERSION) {
    errors.push(`generator version mismatch: ${inventory.snapshot.generatorVersion}`);
  }
  const expectedDigest = computeInventoryPayloadSha256(inventory);
  if (inventory.inventoryPayloadSha256 !== expectedDigest) {
    errors.push(`inventory payload digest mismatch: ${inventory.inventoryPayloadSha256} != ${expectedDigest}`);
  }
  const contentIds = new Set(inventory.content.map((item) => item.legacyContentId));
  addDuplicates(errors, "LegacyContentId", inventory.content.map((item) => item.legacyContentId));
  addDuplicates(errors, "legacy content path", inventory.content.map((item) => item.legacyPath));
  addDuplicates(errors, "route", inventory.routes.map((item) => item.urlPath));
  addDuplicates(errors, "media path", inventory.media.map((item) => item.legacyPath));
  addDuplicates(errors, "taxonomy record", inventory.taxonomy.map((item) => `${item.namespace}\0${item.rawValue}`));
  addDuplicates(errors, "interactive component", inventory.interactive.map((item) => item.componentPath));
  addDuplicates(errors, "LegacyHtml content", inventory.legacyHtml.map((item) => item.contentId));
  addDuplicates(errors, "content mapping", inventory.contentMappings.map((item) => item.legacyContentId));
  addDuplicates(errors, "route parity", inventory.routeParity.map((item) => item.legacyPath));
  addDuplicates(errors, "media mapping", inventory.mediaMappings.map((item) => item.legacyPath));
  for (const media of inventory.media) {
    addDuplicates(errors, `media reference ${media.legacyPath}`, media.referencedByContentIds);
    for (const contentId of media.referencedByContentIds) {
      if (!contentIds.has(contentId)) errors.push(`media ${media.legacyPath} references missing content ${contentId}`);
    }
  }
  for (const taxonomy of inventory.taxonomy) {
    const uniqueIds = new Set(taxonomy.contentIds);
    if (taxonomy.usageCount !== uniqueIds.size) {
      errors.push(`taxonomy ${taxonomy.namespace}:${taxonomy.rawValue} usageCount ${taxonomy.usageCount} != ${uniqueIds.size}`);
    }
    if (uniqueIds.size !== taxonomy.contentIds.length) {
      errors.push(`taxonomy ${taxonomy.namespace}:${taxonomy.rawValue} contains duplicate content IDs`);
    }
    for (const contentId of taxonomy.contentIds) {
      if (!contentIds.has(contentId)) errors.push(`taxonomy ${taxonomy.namespace}:${taxonomy.rawValue} references missing content ${contentId}`);
    }
  }
  for (const interactive of inventory.interactive) {
    addDuplicates(errors, `interactive reference ${interactive.componentPath}`, interactive.usedByContentIds);
    for (const contentId of interactive.usedByContentIds) {
      if (!contentIds.has(contentId)) errors.push(`interactive ${interactive.componentPath} references missing content ${contentId}`);
    }
  }
  for (const legacyHtml of inventory.legacyHtml) {
    if (!contentIds.has(legacyHtml.contentId)) errors.push(`LegacyHtml references missing content ${legacyHtml.contentId}`);
  }
  for (const mapping of inventory.contentMappings) {
    if (!contentIds.has(mapping.legacyContentId)) errors.push(`content mapping references missing content ${mapping.legacyContentId}`);
  }
  return errors;
};

export interface LegacyInventorySummary {
  readonly publishedContentCounts: Readonly<Record<LegacyCollection, number>>;
  readonly totalContentCounts: Readonly<Record<LegacyCollection, number>>;
  readonly totalContentCount: number;
  readonly routeCount: number;
  readonly wordpressQueryIdentityCount: number;
  readonly gitMediaCount: number;
  readonly gitMediaBytes: number;
  readonly unresolvedMediaReferenceCount: number;
  readonly taxonomyRecordCount: number;
  readonly interactiveRecordCount: number;
  readonly legacyHtmlRecordCount: number;
}

const emptyCounts = (): Record<LegacyCollection, number> => ({ blog: 0, notes: 0, projects: 0, tools: 0, pages: 0 });

export const summarizeLegacyInventory = (inventory: MigrationInventory): LegacyInventorySummary => {
  const publishedContentCounts = emptyCounts();
  const totalContentCounts = emptyCounts();
  for (const content of inventory.content) {
    totalContentCounts[content.collection] += 1;
    if (!content.draft) publishedContentCounts[content.collection] += 1;
  }
  const gitMedia = inventory.media.filter((item) => item.verificationStatus === "git_verified");
  return {
    publishedContentCounts,
    totalContentCounts,
    totalContentCount: inventory.content.length,
    routeCount: inventory.routes.length,
    wordpressQueryIdentityCount: inventory.routes.filter((item) => /^\/\?p=\d+$/u.test(item.urlPath)).length,
    gitMediaCount: gitMedia.length,
    gitMediaBytes: gitMedia.reduce((total, item) => total + item.sizeBytes, 0),
    unresolvedMediaReferenceCount: inventory.media.filter((item) => item.verificationStatus === "unresolved_non_local").length,
    taxonomyRecordCount: inventory.taxonomy.length,
    interactiveRecordCount: inventory.interactive.length,
    legacyHtmlRecordCount: inventory.legacyHtml.length,
  };
};

export interface MigrationParityReport {
  readonly schemaVersion: 1;
  readonly inventoryPayloadSha256: string;
  readonly inventoryIntegrity: "PASS";
  readonly migrationCutoverReadiness: "BLOCKED";
  readonly content: Readonly<{ total: number; published: number; mapped: number; unmapped: number }>;
  readonly routes: Readonly<{ total: number; classified: number; unclassified: number }>;
  readonly media: Readonly<{ referenced: number; gitBacked: number; unresolvedNonLocal: number; mapped: number; unmapped: number }>;
  readonly taxonomy: Readonly<{ rawTerms: number; mapped: number; unresolved: number }>;
  readonly interactive: Readonly<{ components: number; mapped: number; unresolved: number }>;
  readonly legacyHtml: Readonly<{ records: number; resolved: number; unresolved: number }>;
}

export const deriveMigrationParityReport = (inventory: MigrationInventory): MigrationParityReport => {
  const mappedContent = new Set(inventory.contentMappings.map((item) => item.legacyContentId));
  const classifiedRoutes = new Set(inventory.routeParity.map((item) => item.legacyPath));
  const mappedMedia = new Set(inventory.mediaMappings.map((item) => item.legacyPath));
  const referencedMedia = new Set(inventory.content.flatMap((item) => item.referencedMediaPaths));
  const mappedInteractive = inventory.interactive.filter((item) => item.disposition !== undefined).length;
  const resolvedLegacyHtml = inventory.legacyHtml.filter(
    (item) => item.extractionStatus === "static" && item.disposition !== "manual_review",
  ).length;
  return {
    schemaVersion: 1,
    inventoryPayloadSha256: inventory.inventoryPayloadSha256,
    inventoryIntegrity: "PASS",
    migrationCutoverReadiness: "BLOCKED",
    content: {
      total: inventory.content.length,
      published: inventory.content.filter((item) => !item.draft).length,
      mapped: mappedContent.size,
      unmapped: inventory.content.length - mappedContent.size,
    },
    routes: {
      total: inventory.routes.length,
      classified: classifiedRoutes.size,
      unclassified: inventory.routes.length - classifiedRoutes.size,
    },
    media: {
      referenced: referencedMedia.size,
      gitBacked: inventory.media.filter((item) => item.verificationStatus === "git_verified").length,
      unresolvedNonLocal: inventory.media.filter((item) => item.verificationStatus === "unresolved_non_local").length,
      mapped: mappedMedia.size,
      unmapped: referencedMedia.size - mappedMedia.size,
    },
    taxonomy: { rawTerms: inventory.taxonomy.length, mapped: 0, unresolved: inventory.taxonomy.length },
    interactive: {
      components: inventory.interactive.length,
      mapped: mappedInteractive,
      unresolved: inventory.interactive.length - mappedInteractive,
    },
    legacyHtml: {
      records: inventory.legacyHtml.length,
      resolved: resolvedLegacyHtml,
      unresolved: inventory.legacyHtml.length - resolvedLegacyHtml,
    },
  };
};

export const verifyLegacyTagIdentity = (
  repositoryRoot: string,
  expected: Readonly<{ tag: string; tagObjectSha: string; commitSha: string }>,
): readonly string[] => {
  const errors: string[] = [];
  const attempt = (args: readonly string[]): string | undefined => {
    try {
      return gitText(repositoryRoot, args);
    } catch {
      return undefined;
    }
  };
  const reference = `refs/tags/${expected.tag}`;
  const tagObjectSha = attempt(["rev-parse", "--verify", reference]);
  if (!tagObjectSha) return [`legacy tag missing: ${expected.tag}`];
  const type = attempt(["cat-file", "-t", reference]);
  if (type !== "tag") errors.push(`legacy tag must be annotated: ${expected.tag} is ${type ?? "unreadable"}`);
  if (tagObjectSha !== expected.tagObjectSha) {
    errors.push(`legacy tag object mismatch: ${tagObjectSha} != ${expected.tagObjectSha}`);
  }
  const peeled = attempt(["rev-parse", `${expected.tag}^{}`]);
  if (peeled !== expected.commitSha) errors.push(`legacy tag peeled commit mismatch: ${peeled ?? "unreadable"} != ${expected.commitSha}`);
  return errors;
};

export const validateBaselineAgainstInventory = (
  baselineCandidate: unknown,
  inventory: MigrationInventory,
): readonly string[] => {
  const parsed = legacyFreezeBaselineSchema.safeParse(baselineCandidate);
  if (!parsed.success) return parsed.error.issues.map((issue) => `baseline schema ${issue.path.join(".")}: ${issue.message}`);
  const baseline = parsed.data;
  const summary = summarizeLegacyInventory(inventory);
  const errors: string[] = [];
  const compare = (label: string, actual: unknown, expected: unknown): void => {
    if (fingerprint(actual) !== fingerprint(expected)) errors.push(`${label} mismatch`);
  };
  if (baseline.repository !== LEGACY_REPOSITORY) errors.push(`baseline repository mismatch: ${baseline.repository}`);
  if (baseline.tag !== LEGACY_TAG) errors.push(`baseline tag mismatch: ${baseline.tag}`);
  if (baseline.commitSha !== LEGACY_COMMIT) errors.push(`baseline commit mismatch: ${baseline.commitSha}`);
  if (baseline.generatorVersion !== LEGACY_INVENTORY_GENERATOR_VERSION) errors.push(`baseline generator version mismatch`);
  if (baseline.inventoryPayloadSha256 !== inventory.inventoryPayloadSha256) errors.push(`baseline inventory digest mismatch`);
  compare("published content counts", baseline.publishedContentCounts, summary.publishedContentCounts);
  compare("total content counts", baseline.totalContentCounts, summary.totalContentCounts);
  for (const key of [
    "totalContentCount", "routeCount", "wordpressQueryIdentityCount", "gitMediaCount", "gitMediaBytes",
    "taxonomyRecordCount", "interactiveRecordCount", "legacyHtmlRecordCount", "unresolvedMediaReferenceCount",
  ] as const) {
    if (baseline[key] !== summary[key]) errors.push(`${key} mismatch: ${baseline[key]} != ${summary[key]}`);
  }
  compare("design-time baseline", baseline.designTimeBaseline, DESIGN_TIME_BASELINE);
  compare("design-time published content delta", summary.publishedContentCounts, DESIGN_TIME_BASELINE.publishedContentCounts);
  if (summary.gitMediaBytes !== DESIGN_TIME_BASELINE.gitMediaBytes) {
    errors.push(`design-time media byte delta: ${summary.gitMediaBytes - DESIGN_TIME_BASELINE.gitMediaBytes}`);
  }
  if (summary.wordpressQueryIdentityCount !== DESIGN_TIME_BASELINE.wordpressQueryIdentityCount) {
    errors.push(`design-time WordPress query identity delta: ${summary.wordpressQueryIdentityCount - DESIGN_TIME_BASELINE.wordpressQueryIdentityCount}`);
  }
  if (summary.interactiveRecordCount !== DESIGN_TIME_BASELINE.interactiveRecordCount) {
    errors.push(`design-time interactive delta: ${summary.interactiveRecordCount - DESIGN_TIME_BASELINE.interactiveRecordCount}`);
  }
  return errors;
};

export const parseLegacyFreezeBaseline = (candidate: unknown): LegacyFreezeBaseline => legacyFreezeBaselineSchema.parse(candidate);

export const normalizeBuiltFileToEndpoint = (relativePath: string): string | undefined => {
  const path = relativePath.replaceAll("\\", "/");
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  if (path.endsWith(".html") || path.endsWith(".xml") || path === "robots.txt") return `/${path}`;
  return undefined;
};

export const inventoryEndpointPaths = (inventory: MigrationInventory): readonly string[] =>
  inventory.routes.filter((item) => !item.urlPath.includes("?")).map((item) => item.urlPath).sort(compareCanonicalKeys);
