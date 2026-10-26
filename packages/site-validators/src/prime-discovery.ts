import { parse, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
const attr = (node: Node, name: string) => "attrs" in node ? node.attrs.find(a => a.name === name)?.value : undefined;
const elements = (node: Node): Node[] => ["tagName" in node ? [node] : [], "childNodes" in node ? node.childNodes.flatMap(elements) : []].flat();
const text = (node: Node): string => "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(text).join("") : "";
// The guide must exist before JavaScript and outside closed help or the interactive island.
const visible = (node: Node): string => "tagName" in node && (["script", "style", "astro-island"].includes(node.tagName) || attr(node, "hidden") !== undefined || (node.tagName === "details" && attr(node, "open") === undefined)) ? "" : "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(visible).join("") : "";
const canonical = "https://xpotato.net/tools/prime-factorizer/";
export function validatePrimeDiscovery(html: string, toolsHtml: string, sitemap: string): string[] {
  const nodes = elements(parse(html)), errors: string[] = [];
  const select = (tag: string, key?: string, value?: string) => nodes.filter(n => "tagName" in n && n.tagName === tag && (!key || attr(n, key) === value));
  const links = select("link", "rel", "canonical");
  if (links.length !== 1 || attr(links[0]!, "href") !== canonical) errors.push("prime: self canonical missing or duplicate");
  if (select("meta", "name", "robots").some(n => /noindex|none/iu.test(attr(n, "content") ?? ""))) errors.push("prime: unexpectedly noindex");
  if (select("h1").length !== 1 || text(select("h1")[0]!) !== "素因数分解機") errors.push("prime: one descriptive h1 required");
  const body = select("main")[0], prose = body ? visible(body) : "";
  if (!/素数だけの積/u.test(prose) || !prose.includes("2³ × 3² × 5") || !prose.includes("2² × 3") || !prose.includes("97")) errors.push("prime: static definition and calculation examples missing");
  if (!prose.includes("残りの数") || !prose.includes("証明")) errors.push("prime: static result limitations missing");
  const guide = select("h2").find(n => text(n).startsWith("使い方と計算例"));
  const island = select("astro-island")[0];
  if (!guide || !island || nodes.indexOf(island) > nodes.indexOf(guide)) errors.push("prime: interactive tool must precede guide");
  if (select("nav").some(n => (attr(n, "class") ?? "").split(/\s/u).includes("table-of-contents"))) errors.push("prime: guide must not insert a table of contents above the tool");
  const listNodes = elements(parse(toolsHtml));
  if (!listNodes.some(n => "tagName" in n && n.tagName === "a" && attr(n, "href") === "/tools/prime-factorizer/")) errors.push("prime: tools archive crawlable link missing");
  if (!sitemap.includes("<loc>" + canonical + "</loc>")) errors.push("prime: canonical missing from sitemap");
  const data = select("script", "type", "application/ld+json").flatMap(n => { try { return [JSON.parse(text(n)) as Record<string, unknown>]; } catch { return []; } });
  if (!data.some(d => d["@type"] === "WebPage" && d.url === canonical)) errors.push("prime: WebPage identity missing");
  if (data.some(d => ["FAQPage", "AggregateRating", "Review"].includes(String(d["@type"])))) errors.push("prime: unsupported rich-result entity");
  return errors;
}
