import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { SearchDocument } from "@xpotato/content-contracts";
import { searchDocumentSchema } from "@xpotato/content-contracts";
import { tokenizeCjkSingles } from "./tokenizer.js";

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlParentNode = DefaultTreeAdapterMap["parentNode"];
type HtmlElement = DefaultTreeAdapterMap["element"];

const excludedTextElements = new Set(["script", "style", "noscript", "template"]);
const blockElements = new Set([
  "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "footer",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const childrenOf = (node: HtmlNode | HtmlParentNode): readonly HtmlNode[] => "childNodes" in node ? node.childNodes : [];
const attribute = (element: HtmlElement, name: string): string | undefined => element.attrs.find((item) => item.name === name)?.value;

const visitElements = (node: HtmlNode | HtmlParentNode, visit: (element: HtmlElement) => void): void => {
  for (const child of childrenOf(node)) {
    if (isElement(child)) visit(child);
    visitElements(child, visit);
  }
};

const hasNoindex = (document: HtmlParentNode): boolean => {
  let noindex = false;
  visitElements(document, (element) => {
    if (element.tagName !== "meta") return;
    const name = attribute(element, "name")?.toLowerCase();
    if (name !== "robots" && name !== "googlebot") return;
    const directives = (attribute(element, "content") ?? "").toLowerCase().split(/[\s,;]+/u);
    if (directives.includes("noindex") || directives.includes("none")) noindex = true;
  });
  return noindex;
};

const textContent = (node: HtmlNode | HtmlParentNode, output: string[]): void => {
  for (const child of childrenOf(node)) {
    if ("value" in child) {
      output.push(child.value);
      continue;
    }
    if (!isElement(child) || excludedTextElements.has(child.tagName) || attribute(child, "hidden") !== undefined || attribute(child, "aria-hidden")?.toLowerCase() === "true") {
      continue;
    }
    const isBlock = blockElements.has(child.tagName);
    if (isBlock) output.push(" ");
    textContent(child, output);
    if (child.tagName === "br" || child.tagName === "wbr" || isBlock) output.push(" ");
  }
};

const normalizedText = (node: HtmlNode | HtmlParentNode): string => {
  const output: string[] = [];
  textContent(node, output);
  return output.join("").replace(/[\s\u00a0]+/gu, " ").trim();
};

const searchableMain = (document: HtmlParentNode): HtmlElement | undefined => {
  let result: HtmlElement | undefined;
  visitElements(document, (element) => {
    if (!result && element.tagName === "main" && element.attrs.some((item) => item.name === "data-search-body")) result = element;
  });
  return result;
};

/** Extracts one rendered, eligible content page. Pages without a search body or with noindex are omitted. */
export const extractSearchDocumentFromHtml = (html: string, route: string): SearchDocument | undefined => {
  const document = parse(html);
  if (hasNoindex(document)) return undefined;
  const main = searchableMain(document);
  if (!main || attribute(main, "data-search-eligible")?.toLowerCase() === "false") return undefined;

  const headingParts: string[] = [];
  visitElements(main, (element) => {
    if (/^h[1-6]$/u.test(element.tagName)) headingParts.push(normalizedText(element));
  });

  const headingText = headingParts.join(" ").replace(/\s+/gu, " ").trim();
  const bodyText = normalizedText(main);
  return searchDocumentSchema.parse({
    id: attribute(main, "data-search-id"),
    route,
    collection: attribute(main, "data-search-collection"),
    title: attribute(main, "data-search-title") ?? "",
    description: attribute(main, "data-search-description") ?? "",
    taxonomyText: attribute(main, "data-search-taxonomy") ?? "",
    headingText,
    bodyText,
    cjkSingles: tokenizeCjkSingles(`${headingText} ${bodyText}`).join(" "),
  });
};

export type SearchHtmlPage = Readonly<{ route: string; html: string }>;

/** Applies the production extractor to HTML pages and provides stable document ordering. */
export const buildSearchDocumentsFromHtmlPages = (pages: readonly SearchHtmlPage[]): SearchDocument[] =>
  pages.flatMap(({ route, html }) => {
    const document = extractSearchDocumentFromHtml(html, route);
    return document ? [document] : [];
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
