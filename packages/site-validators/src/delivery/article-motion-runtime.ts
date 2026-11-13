import { readFile, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { parse, type DefaultTreeAdapterTypes as Tree } from "parse5";
import { articleMediaTargets } from "@xpotato/content-contracts/article-media-targets";

export const articleMotionPath = "/scripts/article-motion.js";
export const articleMotionBudget = { raw: 1600, gzip: 800 } as const;
// Reviewed poster/template-only enhancement. Normalize checkout CRLF, but no other bytes.
// A source change requires a new review and explicit pin update, not a broad JS allowlist.
const reviewedSourceSha256 = "247f071f297530dbd4c5abe2b3d9a28072688ec12f3ac75e9fbbc20285a3e847";
const attr = (node: Tree.Element, name: string) => node.attrs.find(a => a.name === name)?.value;
const isElement = (node: Tree.Node): node is Tree.Element => "tagName" in node;
function fail(): never { throw Error("Article motion requires matching public article media and its single deferred classic script"); }
const exactAttrs = (node: Tree.Element, expected: Record<string, string>) =>
  node.attrs.length === Object.keys(expected).length && node.attrs.every(a => !a.namespace && expected[a.name] === a.value);
const childElements = (node: Tree.ParentNode): Tree.Element[] => {
  if (node.childNodes.some(n => !isElement(n) && !(n.nodeName === "#text" && "value" in n && !n.value.trim()))) fail();
  return node.childNodes.filter(isElement);
};
const descendants = (root: Tree.Node): Tree.Element[] => {
  const nodes: Tree.Element[] = [];
  const visit = (node: Tree.Node) => {
    if (isElement(node)) nodes.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if (isElement(node) && node.tagName === "template") visit((node as Tree.Template).content);
  };
  visit(root); return nodes;
};
const isWithin = (node: Tree.Node, ancestor: Tree.Node): boolean =>
  node === ancestor || ("parentNode" in node && node.parentNode !== null && isWithin(node.parentNode, ancestor));
const positiveInteger = (value: string | undefined) => value !== undefined && /^[1-9]\d*$/u.test(value) && Number.isSafeInteger(Number(value));
const mediaFormat = (value: string | undefined): string | undefined => {
  if (!value?.startsWith(articleMediaTargets.publicOrigin + "/media/v1/objects/sha256/")) return undefined;
  const match = /^([a-f0-9]{2})\/([a-f0-9]{64})\.(avif|webp|jpg|png)$/u.exec(value.slice((articleMediaTargets.publicOrigin + "/media/v1/objects/sha256/").length));
  return match && match[2]!.startsWith(match[1]!) ? (match[3] === "jpg" ? "jpeg" : match[3]) : undefined;
};

function inspectPicture(container: Tree.ParentNode, contentId: string): Tree.Element {
  const children = childElements(container), picture = children[0];
  if (children.length !== 1 || !picture || picture.tagName !== "picture"
    || !exactAttrs(picture, { class: "registry-media", "data-media-content-id": contentId })) fail();
  const parts = childElements(picture), image = parts.at(-1);
  if (!image || image.tagName !== "img" || childElements(image).length) fail();
  const imageAttrs = Object.fromEntries(image.attrs.map(a => [a.name, a.value]));
  const allowed = ["src", "width", "height", "alt", "loading", "decoding", "data-media-asset", "fetchpriority"];
  if (image.attrs.some(a => a.namespace || !allowed.includes(a.name)) || !mediaFormat(imageAttrs.src)
    || !positiveInteger(imageAttrs.width) || !positiveInteger(imageAttrs.height) || imageAttrs.alt === undefined
    || !["lazy", "eager"].includes(imageAttrs.loading ?? "") || imageAttrs.decoding !== "async"
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(imageAttrs["data-media-asset"] ?? "")
    || imageAttrs.fetchpriority !== undefined && (imageAttrs.fetchpriority !== "high" || imageAttrs.loading !== "eager")) fail();
  const formats = new Set<string>();
  for (const source of parts.slice(0, -1)) {
    const type = attr(source, "type") ?? "", srcset = attr(source, "srcset") ?? "", sizes = attr(source, "sizes") ?? "";
    if (source.tagName !== "source" || !exactAttrs(source, { type, srcset, sizes }) || childElements(source).length
      || !/^image\/(?:avif|webp|jpeg|png)$/u.test(type) || formats.has(type) || !sizes.trim() || !srcset) fail();
    formats.add(type);
    const widths = new Set<string>();
    for (const item of srcset.split(",")) {
      const pair = /^(\S+) ([1-9]\d*)w$/u.exec(item.trim());
      if (!pair || mediaFormat(pair[1]) !== type.slice(6) || !positiveInteger(pair[2])
        || Number(pair[2]) > Number(imageAttrs.width) || widths.has(pair[2]!)) fail();
      widths.add(pair[2]!);
    }
  }
  return image;
}

function inspectToggle(button: Tree.Element) {
  if (button.tagName !== "button" || !exactAttrs(button, {
    type: "button", class: "article-motion-toggle", "data-motion-toggle": "", hidden: "",
    "aria-label": "動きを再生", "aria-pressed": "false", title: "再生",
  })) fail();
  const icons = childElements(button);
  if (icons.length !== 2) fail();
  for (const [index, [name, path]] of [["motion-play", "M8 5v14l11-7z"], ["motion-pause", "M6 5h4v14H6zm8 0h4v14h-4z"]].entries()) {
    const icon = icons[index]!, paths = childElements(icon);
    if (icon.tagName !== "svg" || !exactAttrs(icon, { class: name!, "aria-hidden": "true", viewBox: "0 0 24 24" })
      || paths.length !== 1 || paths[0]!.tagName !== "path" || !exactAttrs(paths[0]!, { d: path! })
      || childElements(paths[0]!).length) fail();
  }
}

/** Only the native renderer's static poster, inert moving picture and hidden control opt in. */
export function inspectArticleMotionMarkup(html: string, route: string) {
  let duplicate = false;
  const nodes = descendants(parse(html, { sourceCodeLocationInfo: true, onParseError: error => { if (error.code === "duplicate-attribute") duplicate = true; } }));
  const scripts = nodes.filter(n => n.tagName === "script" && (attr(n, "src") ?? "").includes("article-motion"));
  const markers = ["data-article-motion", "data-motion-view", "data-motion-picture", "data-motion-toggle"];
  const marked = nodes.filter(n => markers.some(marker => attr(n, marker) !== undefined));
  if (!scripts.length && !marked.length) return { htmlWithoutArticleMotion: html, script: false };
  const script = scripts[0], location = script?.sourceCodeLocation;
  const hosts = nodes.filter(n => attr(n, "data-article-motion") !== undefined);
  const publicPath = "/" + route.replaceAll("\\", "/").replace(/^\/+/, "").replace(/index\.html$/u, "");
  const collection = publicPath.startsWith("/articles/") ? "blog" : publicPath.split("/")[1];
  const mains = nodes.filter(n => n.tagName === "main" && attr(n, "data-search-collection") !== undefined);
  const main = mains[0], contentId = main && attr(main, "data-search-id");
  const canonicals = nodes.filter(n => n.tagName === "link" && attr(n, "rel") === "canonical");
  if (duplicate || !/^\/(?:articles|notes|projects)\/[^/]+\/$/u.test(publicPath) || mains.length !== 1 || !main
    || attr(main, "data-search-collection") !== collection || !contentId || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(contentId)
    || canonicals.length !== 1 || attr(canonicals[0]!, "href") !== "https://xpotato.net" + publicPath
    || nodes.some(n => n.tagName === "meta" && (attr(n, "name") === "xpotato-private-draft-preview-v1"
      || attr(n, "name") === "robots" && /noindex/iu.test(attr(n, "content") ?? "")))
    || !hosts.length || marked.length !== hosts.length * markers.length || scripts.length !== 1 || !script || !location
    || !exactAttrs(script, { src: articleMotionPath, defer: "" }) || script.childNodes.length
    || nodes.some(n => n.tagName === "template" && descendants(n).includes(script))) fail();
  for (const host of hosts) {
    const parts = childElements(host), [view, template, button] = parts;
    if (host.tagName !== "span" || !isWithin(host, main) || !exactAttrs(host, { class: "article-motion", "data-article-motion": "", "data-playing": "false" })
      || parts.length !== 3 || !view || view.tagName !== "span" || !exactAttrs(view, { "data-motion-view": "" })
      || !template || template.tagName !== "template" || !exactAttrs(template, { "data-motion-picture": "" }) || !button) fail();
    const still = inspectPicture(view, contentId), motion = inspectPicture((template as Tree.Template).content, contentId);
    if (attr(still, "data-media-asset") === attr(motion, "data-media-asset") || attr(still, "src") === attr(motion, "src")
      || attr(still, "alt") !== attr(motion, "alt")
      || Math.abs(Number(attr(still, "height")) / Number(attr(still, "width")) - Number(attr(motion, "height")) / Number(attr(motion, "width")))
        > 1 / Math.max(Number(attr(still, "width")), Number(attr(motion, "width")))) fail();
    inspectToggle(button);
  }
  return { htmlWithoutArticleMotion: html.slice(0, location.startOffset) + html.slice(location.endOffset), script: true };
}

/** Validate the asset bytes actually supplied to the built security-header gate. */
export function validateArticleMotionSource(source: string) {
  if (!source.length || Buffer.byteLength(source) > articleMotionBudget.raw || gzipSync(source).length > articleMotionBudget.gzip)
    throw Error("Article motion exceeds its isolated source budget");
  if (createHash("sha256").update(source.replaceAll("\r\n", "\n")).digest("hex") !== reviewedSourceSha256)
    throw Error("Article motion differs from the reviewed source; arbitrary code, dependencies, network and storage are forbidden");
}

export async function measureArticleMotionRuntime(dist: string, html: string, route: string) {
  const markup = inspectArticleMotionMarkup(html, route);
  if (!markup.script) return { ...markup, articleMotionAssets: [] };
  const root = await realpath(dist), path = await realpath(join(root, articleMotionPath.slice(1)));
  if (!path.startsWith(root + sep)) throw Error("Article motion runtime escaped dist");
  const bytes = await readFile(path);
  validateArticleMotionSource(bytes.toString("utf8"));
  return { ...markup, articleMotionAssets: [{ path: articleMotionPath, bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length, sha256: createHash("sha256").update(bytes).digest("hex") }] };
}
