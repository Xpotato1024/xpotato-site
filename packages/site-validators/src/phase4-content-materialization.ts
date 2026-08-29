import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  blogFrontmatterSchema,
  noteFrontmatterSchema,
  pageFrontmatterSchema,
  phase4ContentCandidateManifestSchema,
  phase4ContentIdentityMapSchema,
  phase4ContentMaterializationManifestSchema,
  projectFrontmatterSchema,
  toolFrontmatterSchema,
  type Phase4ContentCandidate,
  type Phase4ContentCandidateManifest,
  type Phase4ContentIdentityEntry,
  type Phase4ContentIdentityMap,
  type Phase4ContentMaterializationManifest,
  type Phase4ContentMaterializationRecord,
} from "@xpotato/content-contracts";
import { compareCanonicalKeys, fingerprint, sha256 } from "@xpotato/content-contracts/canonical";
import { parseFragment } from "parse5";
import { stringify as stringifyYaml } from "yaml";
import {
  LEGACY_COMMIT,
  generateLegacyInventory,
  splitLegacyContentSource,
} from "./legacy-inventory.js";
import { validatePortableMdx } from "./portable-mdx.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const identityMapPath = join(repositoryRoot, "docs/migration/content-id-map-v1.json");
const candidateBaselinePath = join(repositoryRoot, "docs/migration/content-candidate-baseline-v1.json");
const materializationManifestPath = join(repositoryRoot, "docs/migration/content-materialization-v1.json");
const materializationVersion = "legacy-content-materialization-v1" as const;

interface HtmlAttributeLike {
  readonly name: string;
  readonly value: string;
}

interface HtmlNodeLike {
  readonly nodeName: string;
  readonly tagName?: string;
  readonly value?: string;
  readonly attrs?: readonly HtmlAttributeLike[];
  readonly childNodes?: readonly HtmlNodeLike[];
}

interface ConvertedBody {
  readonly source: string;
  readonly conversion: Phase4ContentMaterializationRecord["bodyConversion"];
  readonly leadingTitleRemoved: boolean;
  readonly interactiveModuleId?: string;
  readonly legacyHtmlRawSha256?: string;
  readonly editorialReviewId?: string;
}

interface ExpectedMaterialization {
  readonly manifest: Phase4ContentMaterializationManifest;
  readonly files: ReadonlyMap<string, string>;
}

interface ReviewedEditorialBody {
  readonly reviewId: string;
  readonly body: string;
}

const reviewedEditorialBodies = new Map<string, ReviewedEditorialBody>([
  [
    "pages:about",
    {
      reviewId: "phase4-about-current-state-v1",
      body: `このサイトでは、技術メモ、制作記録、補助ノート、小規模なブラウザ内アプリをまとめて公開します。

方針は単純です。

- コンテンツをコードレビュー可能な形で管理する
- 表示速度と SEO を最初から崩さない
- ブログ、ノート、プロジェクト、ブラウザ内アプリを同じ構造で保守する

現在は Astro と MDX を中心に、\`apps/site/src/content/\` のポータブルなコンテンツと必要最小限の Astro / React コンポーネントを、段階的な移行ゲートの下で整備しています。

旧実装の削除や本番切替は、コンテンツ・分類・メディア・URL・SEO・復旧手順の各パリティを確認してから行います。`,
    },
  ],
  [
    "projects:xpotato-site",
    {
      reviewId: "phase4-xpotato-site-current-state-v1",
      body: `このプロジェクトは、WordPress 由来の公開サイトを Astro ベースの静的サイトへ段階移行するための基盤です。

## 目的

- GUI 依存を減らし、コンテンツ・契約・検証をコードレビュー可能にする
- 静的配信を基本にして、必要な箇所だけを明示的なブラウザ内モジュールとして動かす
- ContentId、分類、メディア、URL、公開由来を別々の機械契約で管理する
- 移行完了まで凍結済みの旧実装と復旧証拠を保持する

## 現在の構成

- npm workspace 配下の \`apps/site\` が Astro アプリとapplication-local設定を所有する
- 本文はポータブルな Markdown / MDX と承認済みsemantic moduleで管理する
- ReactはInteractive Module Registryで明示されたislandだけに限定する
- GitHub Actionsでschema、migration evidence、typecheck、build、CSP、search、static outputを決定的に検証する
- 配信先はCloudflare Workers Static Assetsを想定するが、provider activationと本番deployは別gateとしてブロックする

## 移行状況

凍結したlegacy snapshotから恒久ContentIdを割り当て、53件のportable contentを再生成できるPhase 4 pipelineを実装しています。分類、メディア、URL、SEOとdiscoveryのパリティは後続phaseで個別に閉じます。

本番切替、旧実装の削除、Cloudflare・R2・DNSの変更は、後続gateとrollback確認が完了するまで行いません。`,
    },
  ],
]);

export const reviewedEditorialBodyFor = (legacyContentId: string): ReviewedEditorialBody | undefined =>
  reviewedEditorialBodies.get(legacyContentId);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

const readLegacyBlob = (legacyPath: string): Buffer =>
  execFileSync("git", ["cat-file", "blob", `${LEGACY_COMMIT}:${legacyPath}`], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });

const childNodes = (node: HtmlNodeLike): readonly HtmlNodeLike[] => node.childNodes ?? [];
const tagName = (node: HtmlNodeLike): string => (node.tagName ?? node.nodeName).toLowerCase();
const attribute = (node: HtmlNodeLike, name: string): string | undefined =>
  node.attrs?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value;

const escapeMdxText = (value: string): string => value.replace(/[{}]/gu, (character) => `\\${character}`);
const collapseInlineWhitespace = (value: string): string => escapeMdxText(value.replace(/\s+/gu, " "));

const textContent = (node: HtmlNodeLike): string => {
  if (node.nodeName === "#text") return node.value ?? "";
  return childNodes(node).map(textContent).join("");
};

const inlineCode = (value: string): string => {
  const longest = Math.max(0, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const padding = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${padding}${value}${padding}${fence}`;
};

const renderInline = (node: HtmlNodeLike): string => {
  if (node.nodeName === "#text") return collapseInlineWhitespace(node.value ?? "");
  const tag = tagName(node);
  const contents = (): string => childNodes(node).map(renderInline).join("");
  if (["strong", "b"].includes(tag)) return `**${contents().trim()}**`;
  if (["em", "i"].includes(tag)) return `*${contents().trim()}*`;
  if (tag === "code") return inlineCode(textContent(node));
  if (tag === "a") {
    const href = attribute(node, "href");
    const label = contents().trim() || href || "";
    return href ? `[${label}](${href})` : label;
  }
  if (tag === "br") return "\n";
  if (tag === "img") return "";
  if (["span", "small", "mark", "sup", "sub"].includes(tag)) return contents();
  return contents();
};

const indentContinuation = (source: string, width: number): string => {
  const lines = source.trim().split("\n");
  const padding = " ".repeat(width);
  return lines.map((line, index) => index === 0 ? line : line.length === 0 ? "" : `${padding}${line}`).join("\n");
};

const inlineListItemTags = new Set(["strong", "b", "em", "i", "code", "a", "span", "small", "mark", "sup", "sub", "br", "img"]);
const isInlineListItemChild = (node: HtmlNodeLike): boolean =>
  node.nodeName === "#text" || inlineListItemTags.has(tagName(node));

const renderList = (node: HtmlNodeLike, ordered: boolean): string => {
  const items = childNodes(node).filter((item) => tagName(item) === "li");
  return items.map((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : "- ";
    const content = childNodes(item).every(isInlineListItemChild)
      ? childNodes(item).map(renderInline).join("").trim()
      : renderBlockChildren(item).trim();
    const indented = indentContinuation(content, prefix.length);
    return `${prefix}${indented}`;
  }).join("\n");
};

const renderPre = (node: HtmlNodeLike): string => {
  const codeNode = childNodes(node).find((item) => tagName(item) === "code");
  const raw = textContent(codeNode ?? node).replace(/^\n/u, "").replace(/\n?$/u, "\n");
  const className = codeNode ? attribute(codeNode, "class") : undefined;
  const language = className?.split(/\s+/u).find((item) => item.startsWith("language-"))?.slice("language-".length) ?? "";
  const longest = Math.max(0, ...[...raw.matchAll(/`{3,}/gu)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${raw}${fence}\n\n`;
};

const renderBlock = (node: HtmlNodeLike): string => {
  if (node.nodeName === "#text") {
    const value = collapseInlineWhitespace(node.value ?? "").trim();
    return value.length > 0 ? `${value}\n\n` : "";
  }
  const tag = tagName(node);
  if (/^h[1-6]$/u.test(tag)) {
    const level = Number(tag.slice(1));
    return `${"#".repeat(level)} ${childNodes(node).map(renderInline).join("").trim()}\n\n`;
  }
  if (tag === "p") {
    const value = childNodes(node).map(renderInline).join("").trim();
    return value.length > 0 ? `${value}\n\n` : "";
  }
  if (tag === "ul") return `${renderList(node, false)}\n\n`;
  if (tag === "ol") return `${renderList(node, true)}\n\n`;
  if (tag === "pre") return renderPre(node);
  if (tag === "blockquote") {
    const inner = renderBlockChildren(node).trim();
    return `${inner.split("\n").map((line) => line.length > 0 ? `> ${line}` : "> ").join("\n")}\n\n`;
  }
  if (tag === "hr") return "---\n\n";
  if (tag === "img") return "";
  if (["div", "section", "article", "main", "header", "footer", "figure", "figcaption"].includes(tag)) {
    return renderBlockChildren(node);
  }
  if (["strong", "b", "em", "i", "code", "a", "span", "small", "mark", "sup", "sub", "br"].includes(tag)) {
    const value = renderInline(node).trim();
    return value.length > 0 ? `${value}\n\n` : "";
  }
  if (tag === "li") return renderBlockChildren(node);
  throw new Error(`Unsupported LegacyHtml element <${tag}>`);
};

const renderBlockChildren = (node: HtmlNodeLike): string => childNodes(node).map(renderBlock).join("");

const normalizeMarkdown = (source: string): string =>
  source
    .replace(/[ \t]+$/gmu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

export const htmlFragmentToPortableMarkdown = (html: string): string => {
  const fragment = parseFragment(html) as unknown as HtmlNodeLike;
  const markdown = normalizeMarkdown(renderBlockChildren(fragment));
  if (markdown.length === 0) throw new Error("LegacyHtml conversion produced an empty body");
  return markdown;
};

const removeRuntimeImports = (source: string): string =>
  source.replace(/^[ \t]*(?:import|export)\b[^\n]*(?:\n|$)/gmu, "");

const extractStaticLegacyHtml = (source: string): Readonly<{ sourceWithoutComponent: string; rawHtml: string }> => {
  const pattern = /<LegacyHtml\b[\s\S]*?\bhtml=\{("(?:\\.|[^"\\])*")\}[\s\S]*?\/>/gu;
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1 || !matches[0]?.[0] || !matches[0][1]) {
    throw new Error(`Expected exactly one statically recoverable LegacyHtml component, found ${matches.length}`);
  }
  const rawHtml = JSON.parse(matches[0][1]) as unknown;
  if (typeof rawHtml !== "string") throw new Error("LegacyHtml literal did not decode to a string");
  return { sourceWithoutComponent: source.replace(matches[0][0], htmlFragmentToPortableMarkdown(rawHtml)), rawHtml };
};

export const convertPrimeFactorizerBody = (source: string): string => {
  const demo = '<Demo module="prime-factorizer" title="素因数分解を試す" />';
  const wrapped = /<div\b[^>]*>\s*<PrimeFactorizer\b[^>]*\/>\s*<\/div>/gu;
  const standalone = /<PrimeFactorizer\b[^>]*\/>/gu;
  const wrappedMatches = [...source.matchAll(wrapped)];
  const standaloneMatches = [...source.matchAll(standalone)];
  if (wrappedMatches.length === 1) return source.replace(wrapped, demo);
  if (wrappedMatches.length === 0 && standaloneMatches.length === 1) return source.replace(standalone, demo);
  throw new Error(`Expected one PrimeFactorizer island, found wrapped=${wrappedMatches.length}, standalone=${standaloneMatches.length}`);
};

const removeDeferredMedia = (source: string, locators: readonly string[]): string => {
  const locatorSet = new Set(locators);
  let result = source.replace(/<AssetImage\b[\s\S]*?\/>/gu, (component) => {
    const src = /\bsrc=["']([^"']+)["']/u.exec(component)?.[1];
    if (!src || !locatorSet.has(src)) throw new Error(`AssetImage locator is not present in frozen media evidence: ${src ?? "missing"}`);
    return "";
  });
  result = result.replace(/<img\b[^>]*>/gu, (component) => {
    const src = /\bsrc=["']([^"']+)["']/u.exec(component)?.[1];
    if (src && !locatorSet.has(src)) throw new Error(`HTML image locator is not present in frozen media evidence: ${src}`);
    return "";
  });
  result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu, (image, _alt: string, locator: string) => {
    if (!locatorSet.has(locator)) return image;
    return "";
  });
  for (const locator of locators) {
    if (result.includes(locator)) throw new Error(`Deferred media locator remains in portable body: ${locator}`);
  }
  return result;
};

export const stripLeadingTitleHeading = (source: string, title: string): Readonly<{ source: string; removed: boolean }> => {
  const match = /^\s*#\s+([^\n]+)\n+/u.exec(source);
  if (!match?.[0] || !match[1]) return { source, removed: false };
  const normalize = (value: string): string => value.replace(/[*_`]/gu, "").replace(/\s+/gu, " ").trim();
  if (normalize(match[1]) !== normalize(title)) return { source, removed: false };
  return { source: source.slice(match[0].length), removed: true };
};

const isoDate = (value: unknown, field: string, legacyPath: string): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value.slice(0, 10))) return value.slice(0, 10);
  throw new Error(`${legacyPath}: ${field} is not an ISO date`);
};

const optionalIsoDate = (value: unknown, field: string, legacyPath: string): string | undefined =>
  value === undefined ? undefined : isoDate(value, field, legacyPath);

const optionalString = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined;
const optionalBoolean = (value: unknown): boolean | undefined => typeof value === "boolean" ? value : undefined;
const optionalInteger = (value: unknown): number | undefined => typeof value === "number" && Number.isInteger(value) ? value : undefined;

const publicationFields = (data: Readonly<Record<string, unknown>>, targetDraft: boolean): Record<string, unknown> => {
  const legacyPath = optionalString(data.legacyPath);
  const canonical = optionalString(data.canonical);
  const seo = canonical?.startsWith("https://") ? { canonicalOverride: canonical } : undefined;
  return {
    draft: targetDraft,
    ...(legacyPath ? { legacyUrls: [legacyPath] } : {}),
    ...(seo ? { seo } : {}),
  };
};

const blogCategory = (legacyContentId: string, data: Readonly<Record<string, unknown>>): "software" | "infrastructure" | "robotics" => {
  if (legacyContentId === "blog:vibration-robot") return "robotics";
  if (data.category === "devlog") return "software";
  return "infrastructure";
};

const projectStatus = (value: unknown, legacyPath: string): "planned" | "active" | "archived" => {
  if (value === "planning") return "planned";
  if (value === "active" || value === "archived") return value;
  throw new Error(`${legacyPath}: unsupported legacy Project status ${String(value)}`);
};

const buildFrontmatter = (
  entry: Phase4ContentIdentityEntry,
  candidate: Phase4ContentCandidate,
  data: Readonly<Record<string, unknown>>,
  targetDraft: boolean,
): Readonly<Record<string, unknown>> => {
  const updatedDate = optionalIsoDate(data.updatedDate, "updatedDate", entry.legacyPath);
  const publication = publicationFields(data, targetDraft);
  if (entry.collection === "blog") {
    return blogFrontmatterSchema.parse({
      id: entry.vNextContentId,
      title: candidate.title,
      description: candidate.description,
      pubDate: isoDate(data.pubDate, "pubDate", entry.legacyPath),
      ...(updatedDate ? { updatedDate } : {}),
      category: blogCategory(entry.legacyContentId, data),
      tags: [],
      ...publication,
    });
  }
  if (entry.collection === "notes") {
    return noteFrontmatterSchema.parse({
      id: entry.vNextContentId,
      title: candidate.title,
      description: candidate.description,
      pubDate: isoDate(data.pubDate, "pubDate", entry.legacyPath),
      ...(updatedDate ? { updatedDate } : {}),
      subject: "infrastructure",
      tags: [],
      ...publication,
    });
  }
  if (entry.collection === "projects") {
    const repository = optionalString(data.repoUrl);
    const demo = optionalString(data.demoUrl);
    const showRepository = data.showRepoLink !== false;
    const confidential = data.confidential === true;
    const links = {
      ...(repository && showRepository ? { repository } : {}),
      ...(demo ? { demo } : {}),
    };
    const sourceAvailability = confidential
      ? "private" as const
      : repository
        ? showRepository ? "public" as const : "private" as const
        : "not_applicable" as const;
    const featured = optionalBoolean(data.featured);
    const featuredOrder = optionalInteger(data.featuredOrder);
    return projectFrontmatterSchema.parse({
      id: entry.vNextContentId,
      title: candidate.title,
      description: candidate.description,
      pubDate: isoDate(data.pubDate, "pubDate", entry.legacyPath),
      ...(updatedDate ? { updatedDate } : {}),
      status: projectStatus(data.status, entry.legacyPath),
      tags: [],
      ...(featured !== undefined ? { featured } : {}),
      ...(featuredOrder !== undefined ? { featuredOrder } : {}),
      ...(Object.keys(links).length > 0 ? { links } : {}),
      sourceAvailability,
      ...publication,
    });
  }
  if (entry.collection === "tools") {
    const featured = optionalBoolean(data.featured);
    return toolFrontmatterSchema.parse({
      id: entry.vNextContentId,
      title: candidate.title,
      description: candidate.description,
      pubDate: isoDate(data.pubDate, "pubDate", entry.legacyPath),
      ...(updatedDate ? { updatedDate } : {}),
      category: "calculation",
      tags: [],
      ...(featured !== undefined ? { featured } : {}),
      ...publication,
    });
  }
  const pageUpdatedDate = updatedDate ?? optionalIsoDate(data.pubDate, "pubDate", entry.legacyPath);
  return pageFrontmatterSchema.parse({
    id: entry.vNextContentId,
    title: candidate.title,
    description: candidate.description,
    ...(pageUpdatedDate ? { updatedDate: pageUpdatedDate } : {}),
    ...publication,
  });
};

const convertBody = (
  candidate: Phase4ContentCandidate,
  sourceBody: string,
  title: string,
  legacyHtmlRawSha256: string | undefined,
): ConvertedBody => {
  let body = removeRuntimeImports(sourceBody);
  let conversion: ConvertedBody["conversion"] = "portable_preserved";
  let interactiveModuleId: string | undefined;
  let rawHtmlSha256: string | undefined;
  let editorialReviewId: string | undefined;
  if (candidate.legacyHtmlStatus !== "none") {
    if (!legacyHtmlRawSha256) throw new Error(`${candidate.legacyContentId}: LegacyHtml evidence is not statically verified`);
    const extracted = extractStaticLegacyHtml(body);
    body = extracted.sourceWithoutComponent;
    if (sha256(extracted.rawHtml) !== legacyHtmlRawSha256) throw new Error(`${candidate.legacyContentId}: raw LegacyHtml hash mismatch`);
    conversion = "legacy_html_to_markdown";
    rawHtmlSha256 = legacyHtmlRawSha256;
  } else if (candidate.deferredInteractiveComponents.length > 0) {
    if (candidate.legacyContentId !== "tools:prime-factorizer") {
      throw new Error(`${candidate.legacyContentId}: unreviewed interactive migration`);
    }
    body = convertPrimeFactorizerBody(body);
    conversion = "interactive_registry_conversion";
    interactiveModuleId = "prime-factorizer";
  } else if (candidate.body.status !== "portable_as_is") {
    throw new Error(`${candidate.legacyContentId}: unresolved semantic body conversion`);
  }
  body = removeDeferredMedia(body, candidate.deferredMediaLocators);
  const editorialReview = reviewedEditorialBodyFor(candidate.legacyContentId);
  if (editorialReview) {
    if (conversion !== "portable_preserved" || candidate.body.status !== "portable_as_is") {
      throw new Error(`${candidate.legacyContentId}: editorial replacement requires a portable source body`);
    }
    body = editorialReview.body;
    conversion = "reviewed_editorial_update";
    editorialReviewId = editorialReview.reviewId;
  }
  const titleResult = stripLeadingTitleHeading(body, title);
  body = normalizeMarkdown(titleResult.source);
  const errors = validatePortableMdx(body);
  if (errors.length > 0) throw new Error(`${candidate.legacyContentId}: materialized body is not portable: ${errors.join(", ")}`);
  if (body.length === 0) throw new Error(`${candidate.legacyContentId}: materialized body is empty`);
  return {
    source: body,
    conversion,
    leadingTitleRemoved: titleResult.removed,
    ...(interactiveModuleId ? { interactiveModuleId } : {}),
    ...(rawHtmlSha256 ? { legacyHtmlRawSha256: rawHtmlSha256 } : {}),
    ...(editorialReviewId ? { editorialReviewId } : {}),
  };
};

const serializeContent = (frontmatter: Readonly<Record<string, unknown>>, body: string): string => {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
};

const materializationPayload = (
  mapping: Phase4ContentIdentityMap,
  candidates: Phase4ContentCandidateManifest,
  records: readonly Phase4ContentMaterializationRecord[],
): Omit<Phase4ContentMaterializationManifest, "manifestPayloadSha256"> => ({
  schemaVersion: 1,
  materializationVersion,
  source: mapping.source,
  mappingPayloadSha256: mapping.mappingPayloadSha256,
  candidateManifestPayloadSha256: candidates.manifestPayloadSha256,
  records: [...records].sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId)),
});

export const buildExpectedPhase4Materialization = async (): Promise<ExpectedMaterialization> => {
  const mapping = phase4ContentIdentityMapSchema.parse(await readJson(identityMapPath));
  const candidates = phase4ContentCandidateManifestSchema.parse(await readJson(candidateBaselinePath));
  if (candidates.mappingPayloadSha256 !== mapping.mappingPayloadSha256) throw new Error("candidate/mapping binding mismatch");
  const candidateById = new Map(candidates.candidates.map((candidate) => [candidate.legacyContentId, candidate]));
  const inventory = generateLegacyInventory(repositoryRoot, { generatedAt: "2000-01-01T00:00:00.000Z" });
  const inventoryContentById = new Map(inventory.content.map((item) => [item.legacyContentId, item]));
  const legacyHtmlById = new Map(inventory.legacyHtml.map((item) => [item.contentId, item]));
  const files = new Map<string, string>();
  const records: Phase4ContentMaterializationRecord[] = [];
  const blogCategoryCounts = { software: 0, infrastructure: 0, robotics: 0 };
  for (const entry of [...mapping.entries].sort((left, right) => compareCanonicalKeys(left.legacyContentId, right.legacyContentId))) {
    const candidate = candidateById.get(entry.legacyContentId);
    const inventoryRecord = inventoryContentById.get(entry.legacyContentId);
    if (!candidate || !inventoryRecord) throw new Error(`Missing frozen Phase 4 evidence for ${entry.legacyContentId}`);
    if (candidate.vNextContentId !== entry.vNextContentId || candidate.targetPath !== entry.targetPath) {
      throw new Error(`${entry.legacyContentId}: candidate identity mismatch`);
    }
    const sourceBytes = readLegacyBlob(entry.legacyPath);
    const { bodySource, data } = splitLegacyContentSource(sourceBytes, entry.legacyPath);
    const legacyHtml = legacyHtmlById.get(entry.legacyContentId);
    const legacyHtmlRawSha256 = legacyHtml?.extractionStatus === "static" ? legacyHtml.rawHtmlSha256 : undefined;
    if (legacyHtml && legacyHtml.extractionStatus !== "static") throw new Error(`${entry.legacyContentId}: blocked LegacyHtml requires operator review`);
    const targetDraft = entry.collection === "blog" ? true : candidate.draft;
    const frontmatter = buildFrontmatter(entry, candidate, data, targetDraft);
    const convertedBody = convertBody(candidate, bodySource, candidate.title, legacyHtmlRawSha256);
    const targetSource = serializeContent(frontmatter, convertedBody.source);
    if (files.has(entry.targetPath)) throw new Error(`Duplicate materialized target path: ${entry.targetPath}`);
    files.set(entry.targetPath, targetSource);
    if (entry.collection === "blog") {
      const category = frontmatter.category;
      if (category !== "software" && category !== "infrastructure" && category !== "robotics") {
        throw new Error(`${entry.legacyContentId}: unexpected Blog seed category`);
      }
      blogCategoryCounts[category] += 1;
    }
    const remainingPhases: Array<"taxonomy_phase5" | "media_phase6"> = [];
    if (Object.values(candidate.deferredTaxonomy).some((terms) => terms.length > 0)) remainingPhases.push("taxonomy_phase5");
    if (candidate.deferredMediaLocators.length > 0) remainingPhases.push("media_phase6");
    records.push({
      legacyContentId: entry.legacyContentId,
      vNextContentId: entry.vNextContentId,
      collection: entry.collection,
      legacyPath: entry.legacyPath,
      targetPath: entry.targetPath,
      origin: "legacy_migration",
      sourceFileSha256: sha256(sourceBytes),
      sourceBodySha256: inventoryRecord.bodySha256,
      targetFileSha256: sha256(targetSource),
      targetBodySha256: sha256(convertedBody.source),
      targetFrontmatterSha256: fingerprint(frontmatter),
      sourceDraft: candidate.draft,
      targetDraft,
      publicationHoldReasons: entry.collection === "blog" && !candidate.draft ? ["blog_media_registry"] : [],
      bodyConversion: convertedBody.conversion,
      leadingTitleRemoved: convertedBody.leadingTitleRemoved,
      deferredTaxonomy: candidate.deferredTaxonomy,
      deferredMediaLocators: candidate.deferredMediaLocators,
      mediaOmittedFromPortableBody: candidate.deferredMediaLocators.length > 0,
      ...(convertedBody.interactiveModuleId ? { interactiveModuleId: convertedBody.interactiveModuleId } : {}),
      ...(convertedBody.legacyHtmlRawSha256 ? { legacyHtmlRawSha256: convertedBody.legacyHtmlRawSha256 } : {}),
      ...(convertedBody.editorialReviewId ? { editorialReviewId: convertedBody.editorialReviewId } : {}),
      remainingPhases,
    });
  }
  if (files.size !== 53 || records.length !== 53) throw new Error(`Phase 4 must materialize exactly 53 frozen legacy entities, got ${files.size}`);
  const reviewedRecordIds = records.filter((record) => record.bodyConversion === "reviewed_editorial_update").map((record) => record.legacyContentId).sort(compareCanonicalKeys);
  const expectedReviewedIds = [...reviewedEditorialBodies.keys()].sort(compareCanonicalKeys);
  if (reviewedRecordIds.join("\0") !== expectedReviewedIds.join("\0")) {
    throw new Error(`Reviewed editorial coverage mismatch: ${JSON.stringify(reviewedRecordIds)}`);
  }
  if (blogCategoryCounts.software !== 31 || blogCategoryCounts.infrastructure !== 12 || blogCategoryCounts.robotics !== 1) {
    throw new Error(`Blog seed partition mismatch: ${JSON.stringify(blogCategoryCounts)}`);
  }
  const payload = materializationPayload(mapping, candidates, records);
  const manifest = phase4ContentMaterializationManifestSchema.parse({ ...payload, manifestPayloadSha256: fingerprint(payload) });
  return { manifest, files };
};

export const writePhase4Materialization = async (): Promise<Phase4ContentMaterializationManifest> => {
  const expected = await buildExpectedPhase4Materialization();
  for (const [repositoryPath, source] of expected.files) {
    const path = join(repositoryRoot, repositoryPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source, "utf8");
  }
  await writeFile(materializationManifestPath, `${JSON.stringify(expected.manifest, null, 2)}\n`, "utf8");
  return expected.manifest;
};

export const checkPhase4Materialization = async (): Promise<Phase4ContentMaterializationManifest> => {
  const expected = await buildExpectedPhase4Materialization();
  const committedManifest = phase4ContentMaterializationManifestSchema.parse(await readJson(materializationManifestPath));
  if (JSON.stringify(committedManifest) !== JSON.stringify(expected.manifest)) {
    throw new Error("Committed Phase 4 materialization manifest differs from exact frozen-source regeneration");
  }
  for (const [repositoryPath, expectedSource] of expected.files) {
    const actualSource = await readFile(join(repositoryRoot, repositoryPath), "utf8").catch(() => undefined);
    if (actualSource === undefined) throw new Error(`Materialized content file missing: ${repositoryPath}`);
    if (actualSource !== expectedSource) throw new Error(`Materialized content drift: ${repositoryPath}`);
  }
  return committedManifest;
};
