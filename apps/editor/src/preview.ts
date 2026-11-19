import { renderLineChart } from "@xpotato/portable-content/charts";
import { safeMathMarkup } from "./components/blocks/math.js";
import { collectionFromPath, parseDraft } from "@xpotato/editor-core/draft";
import type { EditorContentRecord } from "@xpotato/editor-core/registry";
import { blockTree, type BlockNode } from "@xpotato/editor-core/blocks";
import {
  semanticContentModulePropsSchemas,
  barChartRowsSchema,
} from "@xpotato/content-contracts/content";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { articleRoute } from "@xpotato/content-contracts/article-route";
import { seriesRegistrySchema, type SeriesRegistry } from "@xpotato/content-contracts/series";
import { seriesForContent, type SeriesNavigation } from "@xpotato/portable-content/series";
import { splitArticleLead } from "../../site/src/features/articles/model/article-lead.js";
import {
  seriesKindLabel,
  seriesStatusLabel,
  seriesLastEntryLabel,
} from "../../site/src/features/series/model/labels.js";
import {
  selectTableOfContents,
  groupTableOfContents,
  type ContentHeading,
} from "../../site/src/shared/blocks/transforms/table-of-contents.js";

export interface PreviewMedia {
  assetId: string;
  src: string;
  alt?: string;
  caption?: string;
  credit?: string;
  creditUrl?: string;
  width?: number;
  height?: number;
}
export interface PreviewOptions {
  media?: readonly PreviewMedia[];
  series?: readonly SeriesNavigation[];
  editorSeries?: EditorSeriesPreview;
  collection?: ContentCollection;
}
export interface EditorSeriesPreview {
  registry: SeriesRegistry;
  documents: readonly EditorContentRecord[];
}
export interface PreviewDocument {
  title: string;
  description: string;
  html: string;
  warnings: string[];
  css: string;
}
type Node = BlockNode & { identifier?: string; label?: string };
const escape = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const localImage = (src: string): boolean =>
  /^blob:https?:\/\//u.test(src) ||
  /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-zA-Z0-9+/=]+$/u.test(src);
const safeLink = (value: string): boolean => {
  if (/[\u0000-\u0020\u007f\\]/u.test(value) || value.startsWith("//")) return false;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(value, "https://xpotato.net/").protocol);
  } catch {
    return false;
  }
};
const iconPaths: Record<string, readonly string[]> = {
  contents: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  note: ["M5 3h10l4 4v14H5z", "M15 3v5h4", "M8 12h8", "M8 16h8"],
  tip: [
    "M9 18h6",
    "M10 21h4",
    "M12 3a7 7 0 0 1 4 12.75c-.72.52-1 1.25-1 2.25H9c0-1-.28-1.73-1-2.25A7 7 0 0 1 12 3z",
  ],
  warning: ["M12 3 2 21h20L12 3z", "M12 9v5", "M12 17h.01"],
  important: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 7v6", "M12 17h.01"],
};
const icon = (name: string) =>
  `<svg class="article-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(iconPaths[name] ?? iconPaths.note!).map((d) => `<path d="${d}"/>`).join("")}</svg>`;

/** Private editing order includes drafts; it must never feed the public projection. */
function editorSeriesNavigation(
  input: EditorSeriesPreview,
  current: { id: string; title: string; collection: ContentCollection },
): SeriesNavigation[] {
  const documents = new Map(input.documents.map((document) => [document.contentId, document]));
  const routeFor = (document: EditorContentRecord | undefined): string => {
    if (!document || collectionFromPath(document.path) !== document.collection) return "";
    if (document.collection === "blog") return articleRoute(document.contentId);
    const slug = document.path.split("/")[2]!.replace(/\.mdx?$/u, "");
    return `/${document.collection === "pages" ? "" : document.collection + "/"}${slug}/`;
  };
  return seriesForContent(
    current.id,
    seriesRegistrySchema.parse(input.registry).series.map((series) => ({
      ...series,
      route: `/series/${series.slug}/`,
      entries: series.entries.map((entry, index) => {
        const document = documents.get(entry.contentId);
        const isCurrent = entry.contentId === current.id;
        return {
          contentId: entry.contentId,
          ...(entry.label ? { label: entry.label } : {}),
          collection: isCurrent ? current.collection : (document?.collection ?? "blog"),
          title: isCurrent ? current.title : (document?.title ?? "未取得の記事"),
          description: "",
          route: routeFor(document),
          ordinal: index + 1,
        };
      }),
    })),
  );
}

/** Author input is parsed as data; no MDX compilation, evaluation, or arbitrary HTML. */
export async function previewDocument(
  source: string,
  options: PreviewOptions = {},
): Promise<PreviewDocument> {
  const { data, body } = parseDraft(source);
  const tree = blockTree(body) as Node;
  const warnings = new Set<string>();
  const css: string[] = [];
  const media = new Map((options.media ?? []).map((item) => [item.assetId, item]));
  const definitions = new Map<string, Node>();
  const footnotes = new Map<string, Node>();
  const footnoteOrder: string[] = [];
  const headings: ContentHeading[] = [];
  const textContent = (node: Node): string =>
    node.value ?? node.children?.map(textContent).join("") ?? "";
  const scan = (node: Node) => {
    if (node.type === "definition" && node.identifier)
      definitions.set(node.identifier.toLowerCase(), node);
    if (node.type === "footnoteDefinition" && node.identifier)
      footnotes.set(node.identifier.toLowerCase(), node);
    for (const child of node.children ?? []) scan(child);
  };
  scan(tree);
  const placeholder = (label: string, detail: string): string =>
    `<aside class="preview-unavailable"><strong>${escape(label)}</strong><p>${escape(detail)}</p></aside>`;
  const link = (
    url: string | undefined,
    label: string,
    title?: string,
    className?: string,
  ): string => {
    if (!url || !safeLink(url)) {
      warnings.add("URLを確認できないリンクがあります。");
      return label;
    }
    return `<a role="link" aria-disabled="true"${className ? ` class="${escape(className)}"` : ""} data-preview-href="${escape(url)}"${title ? ` title="${escape(title)}"` : ""}>${label}</a>`;
  };
  const image = (assetId: string, alt: string, explicit?: PreviewMedia): string => {
    const item = explicit ?? media.get(assetId);
    if (!item || !localImage(item.src)) {
      warnings.add(`画像「${assetId}」をこの端末で読み込めません。`);
      return `<span class="preview-image-missing" role="img" aria-label="${escape(alt)}"><span>画像未登録</span><small>${escape(alt || assetId)}</small></span>`;
    }
    const dimension = (name: "width" | "height") =>
      Number.isSafeInteger(item[name]) && item[name]! > 0 ? ` ${name}="${item[name]}"` : "";
    return `<img src="${escape(item.src)}" alt="${escape(alt || item.alt || "")}"${dimension("width")}${dimension("height")} decoding="async">`;
  };
  const math = (value: string, label: string): string => {
    try {
      const html = safeMathMarkup(value);
      return `<div class="math-block" role="group" aria-label="${escape(label)}" tabindex="0"><p class="math-label">${escape(label)}</p>${html}</div>`;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^KaTeX parse error:\s*/u, "")
          : "数式を確認してください。";
      warnings.add(`数式: ${message}`);
      return `<div class="preview-unavailable"><strong>数式を確認してください</strong><pre><code>${escape(value)}</code></pre><p>${escape(message)}</p></div>`;
    }
  };
  const children = (node: Node): string => (node.children ?? []).map(render).join("");
  const module = (node: Node): string => {
    const name = node.name ?? "";
    const schema = Object.hasOwn(semanticContentModulePropsSchemas, name)
      ? semanticContentModulePropsSchemas[name as keyof typeof semanticContentModulePropsSchemas]
      : undefined;
    if (!schema) {
      warnings.add(`「${name || "MDX"}」は表示に対応していません。`);
      return placeholder(name || "MDX", "この部品は正規レイアウトで確認してください。");
    }
    const props: Record<string, string | boolean> = {};
    for (const attr of node.attributes ?? []) {
      if (
        attr.type !== "mdxJsxAttribute" ||
        !attr.name ||
        (attr.value !== null && typeof attr.value !== "string")
      ) {
        warnings.add(`「${name}」の属性は文字列で指定してください。`);
        return placeholder(name, "属性を確認してください。式は実行しません。");
      }
      props[attr.name] = attr.value === null ? true : attr.value;
    }
    const result = schema.safeParse(props);
    if (!result.success) {
      warnings.add(`「${name}」の設定が不足しているか、値が正しくありません。`);
      return placeholder(
        name,
        result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" / "),
      );
    }
    const p = result.data as Record<string, string | boolean | undefined>;
    const s = (key: string, fallback = "") =>
      typeof p[key] === "string" ? (p[key] as string) : fallback;
    switch (name) {
      case "Group":
        return children(node);
      case "Figure": {
        const item = media.get(s("asset"));
        const caption = s("caption", item?.caption),
          credit = s("credit", item?.credit),
          creditUrl = s("sourceUrl", item?.creditUrl);
        return `<figure class="article-figure${s("width") === "compact" ? " article-compact-figure" : ""}" data-width="${escape(s("width", "content"))}" data-media-asset="${escape(s("asset"))}">${image(s("asset"), s("alt"))}${s("title") || caption || s("note") || credit ? `<figcaption>${s("title") ? `<strong class="article-figure__title">${escape(s("title"))}</strong>` : ""}${caption ? `<p class="article-figure__caption">${escape(caption)}</p>` : ""}${s("note") ? `<p class="article-figure__note">補足：${escape(s("note"))}</p>` : ""}${credit ? `<p class="article-figure__source media-credit">${escape(credit)}${creditUrl ? ` · ${link(creditUrl, "出典")}` : ""}</p>` : ""}</figcaption>` : ""}</figure>`;
      }
      case "Gallery": {
        const diagrams = s("layout") === "diagrams";
        const grid =
          !diagrams ||
          !!(p.columns || p.tabletColumns || p.mobileColumns) ||
          s("gap", "medium") !== "medium" ||
          s("fit", "contain") !== "contain";
        return `<section class="${[diagrams ? "article-diagrams" : "", grid ? "article-gallery" : ""].filter(Boolean).join(" ")}" aria-label="${escape(s("label", "ギャラリー"))}" data-width="${escape(s("width", "content"))}" data-columns="${escape(s("columns", "2"))}" data-tablet-columns="${escape(s("tabletColumns", s("columns", "2")))}" data-mobile-columns="${escape(s("mobileColumns", "1"))}" data-gap="${escape(s("gap", "medium"))}" data-fit="${escape(s("fit", "contain"))}">${children(node)}</section>`;
      }
      case "Callout": {
        const labels: Record<string, string> = {
          note: "補足",
          tip: "ポイント",
          warning: "注意",
          important: "重要",
        };
        return `<aside class="article-callout" data-kind="${escape(s("kind"))}"><span class="article-callout-icon">${icon(s("kind"))}</span><div class="article-callout-content"><strong>${escape(s("title", labels[s("kind")]))}</strong>${children(node)}</div></aside>`;
      }
      case "Steps":
        return `<ol class="article-steps">${children(node)}</ol>`;
      case "Step":
        return `<li class="article-step"><strong class="article-step-title">${escape(s("title"))}</strong><div class="article-step-body">${children(node)}</div>${s("result") ? `<p class="article-step-result">${escape(s("result"))}</p>` : ""}</li>`;
      case "Comparison": {
        const legacy = Boolean(s("leftLabel") && s("rightLabel"));
        const incomplete =
          !legacy &&
          (node.children?.filter((child) => child.name === "ComparisonCase").length ?? 0) < 2;
        const notice = incomplete ? "比較には条件を2つ以上追加してください。" : "";
        if (notice) warnings.add(notice);
        return `<section class="article-comparison" aria-label="条件比較"${legacy ? ` data-left-label="${escape(s("leftLabel"))}" data-right-label="${escape(s("rightLabel"))}"` : ""}>${legacy ? `<header class="article-comparison__legacy-labels"><span>${escape(s("leftLabel"))}</span><span>${escape(s("rightLabel"))}</span></header>` : ""}${notice ? `<p class="preview-unavailable" role="status">${escape(notice)}</p>` : ""}<div class="${legacy ? "article-comparison__legacy-body" : "article-comparison__cases"}">${children(node)}</div></section>`;
      }
      case "ComparisonCase":
        return `<section class="article-comparison__case" aria-label="${escape(s("label"))}"><strong class="article-comparison__case-title">${escape(s("label"))}</strong><div class="article-comparison__case-body">${children(node)}</div></section>`;
      case "LinkCard":
        return link(
          s("href"),
          `${s("label") ? `<span>${escape(s("label"))}</span>` : ""}<strong>${escape(s("title"))}</strong>${s("description") ? `<span>${escape(s("description"))}</span>` : ""}`,
          undefined,
          "article-link-card",
        );
      case "Details":
        return `<details${p.open === true ? " open" : ""}><summary class="disclosure-summary">${escape(s("summary"))}</summary>${children(node)}</details>`;
      case "DiagnosticList":
        return `<dl class="article-diagnostics">${children(node)}</dl>`;
      case "DiagnosticItem":
        return `<div class="article-diagnostic"><dt class="article-diagnostic-symptom">${icon("important")}<span>${escape(s("symptom"))}</span></dt>${[
          ["check", "確認すること"],
          ["action", "見直す候補"],
          ["reason", "理由"],
        ]
          .map(([key, label]) =>
            s(key!)
              ? `<dd class="article-diagnostic-${key}"><span class="article-diagnostic-label">${label}</span><p>${escape(s(key!))}</p></dd>`
              : "",
          )
          .join(
            "",
          )}${node.children?.length ? `<dd class="article-diagnostic-explanation">${children(node)}</dd>` : ""}</div>`;
      case "ArticleEndnote":
        return `<aside class="article-endnote" aria-label="${escape(s("title", "記事について"))}"><p class="article-endnote-title">${escape(s("title", "記事について"))}</p><div class="article-endnote-body">${children(node)}</div></aside>`;
      case "BarChart": {
        const rows = barChartRowsSchema.parse(JSON.parse(s("rows"))),
          max = Number(s("max"));
        const chartId = `preview-chart-${css.length}`;
        const format = (value: number) =>
          value.toLocaleString("ja-JP", { maximumSignificantDigits: 15 });
        css.push(
          rows
            .map((row, index) => `.${chartId}-${index}{width:${(row.value / max) * 100}%}`)
            .join(""),
        );
        return `<figure class="article-bar-chart"><figcaption class="article-bar-chart__title">${escape(s("title"))}</figcaption><p class="article-bar-chart__scale">${escape(s("unit"))} · 0–${format(max)}</p><dl class="article-bar-chart__rows">${rows.map((row, index) => `<div class="article-bar-chart__row"><dt>${escape(row.label)}</dt><dd><span class="article-bar-chart__value">${format(row.value)}<span class="article-bar-chart__unit"> ${escape(s("unit"))}</span></span><span class="article-bar-chart__track" aria-hidden="true"><span class="article-bar-chart__bar article-bar-chart__bar--${row.tone ?? "accent"} ${chartId}-${index}"></span></span>${row.note ? `<span class="article-bar-chart__note">${escape(row.note)}</span>` : ""}</dd></div>`).join("")}</dl><div class="article-bar-chart__axis" aria-hidden="true"><span>0</span><span>${format(max / 2)}</span><span>${format(max)}</span></div></figure>`;
      }
      case "LineChart":
        return renderLineChart(props);
      case "Demo":
        warnings.add(`「${s("title", s("module"))}」は正規レイアウトで動作を確認してください。`);
        return placeholder(
          s("title", s("module")),
          s("description", "動く部品は、この表示では実行しません。"),
        );
      default:
        return placeholder(name, "正規レイアウトで確認してください。");
    }
  };
  function render(node: Node): string {
    switch (node.type) {
      case "root":
        return children(node);
      case "text":
        return escape(node.value);
      case "paragraph":
        return `<p>${children(node)}</p>`;
      case "heading": {
        const depth = Math.min(6, Math.max(1, node.depth ?? 2));
        const slug = `preview-heading-${headings.length + 1}`;
        headings.push({ depth, slug, text: textContent(node) });
        return `<h${depth} id="${slug}">${children(node)}</h${depth}>`;
      }
      case "strong":
        return `<strong>${children(node)}</strong>`;
      case "emphasis":
        return `<em>${children(node)}</em>`;
      case "delete":
        return `<del>${children(node)}</del>`;
      case "inlineCode":
        return `<code>${escape(node.value)}</code>`;
      case "break":
        return "<br>";
      case "thematicBreak":
        return "<hr>";
      case "blockquote":
        return `<blockquote>${children(node)}</blockquote>`;
      case "list":
        return node.ordered
          ? `<ol${node.start && node.start !== 1 ? ` start="${Number(node.start)}"` : ""}>${children(node)}</ol>`
          : `<ul>${children(node)}</ul>`;
      case "listItem":
        return `<li>${typeof node.checked === "boolean" ? `<input type="checkbox" disabled${node.checked ? " checked" : ""} aria-label="チェック項目">` : ""}${children(node)}</li>`;
      case "link":
        return link(node.url, children(node), node.title);
      case "linkReference": {
        const def = definitions.get((node.identifier ?? "").toLowerCase());
        return link(def?.url, children(node), def?.title);
      }
      case "image":
      case "imageReference": {
        const url =
          node.type === "imageReference"
            ? definitions.get((node.identifier ?? "").toLowerCase())?.url
            : node.url;
        const assetId = url?.replace(/^media:/u, "") ?? "画像";
        return image(
          assetId,
          node.alt ?? "",
          options.media?.find((item) => item.src === url),
        );
      }
      case "code": {
        if (node.lang === "math")
          return math(
            node.value ?? "",
            /^label="([^"\r\n]+)"/u.exec(node.meta ?? "")?.[1] ?? "数式",
          );
        return `<figure class="code-block" data-code-block><div class="code-toolbar"><span class="code-language">${escape(node.lang || "text")}</span></div><pre><code${node.lang ? ` class="language-${escape(node.lang)}"` : ""}>${escape(node.value)}</code></pre></figure>`;
      }
      case "table": {
        const rows = node.children ?? [];
        const row = (item: Node, header: boolean) =>
          `<tr>${(item.children ?? []).map((cell, index) => `<${header ? "th" : "td"}${node.align?.[index] ? ` data-align="${node.align[index]}"` : ""}>${children(cell)}</${header ? "th" : "td"}>`).join("")}</tr>`;
        return `<table><thead>${rows[0] ? row(rows[0], true) : ""}</thead><tbody>${rows
          .slice(1)
          .map((item) => row(item, false))
          .join("")}</tbody></table>`;
      }
      case "footnoteReference": {
        const id = (node.identifier ?? "").toLowerCase();
        if (!footnotes.has(id)) return escape(node.label ?? node.identifier);
        if (!footnoteOrder.includes(id)) footnoteOrder.push(id);
        const number = footnoteOrder.indexOf(id) + 1;
        return `<sup><a href="#preview-footnote-${number}" id="preview-footnote-ref-${number}" aria-label="脚注${number}">${number}</a></sup>`;
      }
      case "definition":
      case "footnoteDefinition":
        return "";
      case "mdxJsxFlowElement":
      case "mdxJsxTextElement":
        return module(node);
      default:
        warnings.add("表示に対応していない構文があります。本文は保持しています。");
        return `<pre class="preview-unavailable"><code>${escape(body.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0) || node.value || node.type)}</code></pre>`;
    }
  }
  const rendered = render(tree);
  const sections = groupTableOfContents(selectTableOfContents(headings, body));
  const toc = sections.length
    ? `<nav class="table-of-contents" aria-label="この記事の目次"><p>${icon("contents")}目次</p><ol>${sections
        .map(
          (section) =>
            `<li><a href="#${section.slug}">${escape(section.text)}</a>${section.children.length ? `<ol>${section.children.map((child) => `<li><a href="#${child.slug}">${escape(child.text)}</a></li>`).join("")}</ol>` : ""}</li>`,
        )
        .join("")}</ol></nav>`
    : "";
  const parts =
    options.collection === undefined || options.collection === "blog"
      ? splitArticleLead(rendered)
      : { lead: "", body: rendered };
  const footnoteHtml = footnoteOrder.length
    ? `<section class="footnotes" aria-label="脚注"><h2>脚注</h2><ol>${footnoteOrder.map((id, index) => `<li id="preview-footnote-${index + 1}">${children(footnotes.get(id)!)} <a href="#preview-footnote-ref-${index + 1}" aria-label="本文へ戻る">↩</a></li>`).join("")}</ol></section>`
    : "";
  const collectionLabels = {
    blog: "記事",
    notes: "メモ",
    projects: "制作物",
    tools: "ツール",
    pages: "固定ページ",
  };
  const title = typeof data.title === "string" ? data.title : "無題";
  const description = typeof data.description === "string" ? data.description : "";
  const date = (value: unknown) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : "";
  const publication = date(data.pubDate),
    updated = date(data.updatedDate);
  const membership = options.editorSeries
    ? editorSeriesNavigation(options.editorSeries, {
        id: data.id,
        title,
        collection: options.collection ?? "blog",
      })
    : (options.series ?? []).filter((item) => item.current.contentId === data.id);
  const seriesCount = options.editorSeries ? "登録" : "公開";
  const seriesLink = (route: string, label: string, className?: string) =>
    route
      ? link(route, label, undefined, className)
      : `<span${className ? ` class="${escape(className)}"` : ""}>${label}</span>`;
  const seriesHtml = membership
    .map(({ series, current, previous, next }) =>
      [
        `<nav class="series-navigation" aria-label="${escape(series.title)}の読み順">`,
        `<div class="series-navigation-heading"><div><p class="series-meta">${seriesKindLabel(series.kind)} · ${seriesStatusLabel(series.status)}</p>`,
        `<h2>${seriesLink(series.route, escape(series.title))}</h2></div>`,
        `<span class="series-position">第${current.ordinal}回 / ${seriesCount}${series.entries.length}回</span></div>`,
        options.editorSeries ? '<p class="series-meta">下書きを含む登録順です。</p>' : "",
        '<div class="series-adjacent">',
        previous
          ? seriesLink(
              previous.route,
              `<span class="series-meta">← 前の回 · 第${previous.ordinal}回</span><span>${escape(previous.label ?? previous.title)}</span>`,
              "series-step",
            )
          : '<p class="series-boundary">この連載の最初の回です。</p>',
        next
          ? seriesLink(
              next.route,
              `<span class="series-meta">次の回 · 第${next.ordinal}回 →</span><span>${escape(next.label ?? next.title)}</span>`,
              "series-step",
            )
          : `<p class="series-boundary">${series.status === "completed" ? "この連載の" : ""}${seriesLastEntryLabel(series.status)}です。</p>`,
        "</div>",
        seriesLink(series.route, `全${series.entries.length}回の目次を見る →`, "series-all-link"),
        "</nav>",
      ].join(""),
    )
    .join("");
  return {
    title,
    description,
    warnings: [...warnings],
    css: css.join("\n"),
    html: [
      '<main id="main-content" class="content-page"><article><div class="content-heading">',
      `<p class="eyebrow">${collectionLabels[options.collection ?? "blog"]}</p>`,
      `<h1>${escape(title)}</h1>`,
      description ? `<p class="content-description">${escape(description)}</p>` : "",
      publication
        ? [
            '<div class="article-meta"><div class="article-dates">',
            `<span>公開 <time datetime="${publication}">${publication}</time></span>`,
            updated && updated !== publication
              ? `<span>更新 <time datetime="${updated}">${updated}</time></span>`
              : "",
            "</div></div>",
          ].join("")
        : "",
      membership
        .map(
          ({ series, current }) =>
            `<p class="series-location">${seriesLink(series.route, escape(series.title))}<span>第${current.ordinal}回 / ${seriesCount}${series.entries.length}回</span></p>`,
        )
        .join(""),
      "</div>",
      parts.lead ? `<div class="prose article-lead">${parts.lead}</div>` : "",
      toc,
      `<div class="prose article-body">${parts.body}${footnoteHtml}</div>`,
      seriesHtml,
      "</article></main>",
    ].join(""),
  };
}

export function previewFrameDocument(preview: PreviewDocument, stylesheetUrl: string): string {
  if (!stylesheetUrl.startsWith("blob:")) throw Error("PREVIEW_STYLESHEET_REQUIRED");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src blob:; font-src 'self' data:; img-src blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'; script-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><link rel="stylesheet" href="${escape(stylesheetUrl)}"><title>${escape(preview.title)} · プレビュー</title></head><body>${preview.html}</body></html>`;
}
