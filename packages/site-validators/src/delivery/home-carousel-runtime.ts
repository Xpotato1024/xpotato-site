import { parse, type DefaultTreeAdapterTypes as Tree } from "parse5";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import * as ts from "typescript";
import { sha256 } from "@xpotato/content-contracts/canonical";

const entry = /^\/_astro\/ProjectCarousel\.astro_astro_type_script_index_0_lang\.[A-Za-z0-9_-]+\.js$/u;
export const homeCarouselBudget = { raw: 8000, gzip: 3000 } as const;
export function inspectHomeCarouselMarkup(html: string, route: string) {
  const nodes: Tree.Element[] = []; let duplicate = false;
  const visit = (n: Tree.Node) => { if ("tagName" in n) nodes.push(n); if ("childNodes" in n) n.childNodes.forEach(visit); };
  visit(parse(html, { sourceCodeLocationInfo: true, onParseError: e => { if (e.code === "duplicate-attribute") duplicate = true; } }));
  const attr = (n: Tree.Element, key: string) => n.attrs.find(a => a.name === key)?.value;
  const scripts = nodes.filter(n => n.tagName === "script" && /ProjectCarousel/u.test(attr(n, "src") ?? ""));
  const roots = nodes.filter(n => attr(n, "data-project-carousel") !== undefined || attr(n, "data-project-carousel-empty") !== undefined);
  if (!scripts.length && !roots.length) return { htmlWithoutHomeCarousel: html, script: undefined };
  const script = scripts[0], location = script?.sourceCodeLocation;
  if (duplicate || !["/", "index.html", "/index.html"].includes(route) || roots.length !== 1 || scripts.length !== 1 || !script || !location
    || !entry.test(attr(script, "src") ?? "") || attr(script, "type") !== "module" || script.attrs.length !== 2 || script.childNodes.length) {
    throw Error("Home carousel requires one homepage component and its one bounded local module");
  }
  return { htmlWithoutHomeCarousel: html.slice(0, location.startOffset) + html.slice(location.endOffset), script: attr(script, "src")! };
}
export function validateHomeCarouselSource(sourceText: string) {
  if (!sourceText.includes("data-project-carousel") || Buffer.byteLength(sourceText) > homeCarouselBudget.raw || gzipSync(sourceText).length > homeCarouselBudget.gzip) throw Error("Home carousel source exceeds its isolated budget or is missing");
  const source = ts.createSourceFile("carousel.js", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const inspect = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n) || (ts.isExportDeclaration(n) && n.moduleSpecifier)
      || (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && ["Function", "Worker", "SharedWorker", "WebSocket", "XMLHttpRequest"].includes(n.expression.text))
      || (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && ["require", "eval", "fetch", "Function", "importScripts"].includes(n.expression.text)) || (ts.isPropertyAccessExpression(n.expression) && ["fetch", "sendBeacon"].includes(n.expression.name.text))))
      || (ts.isIdentifier(n) && ["localStorage", "sessionStorage", "indexedDB"].includes(n.text))) throw Error("Home carousel dependencies, network, storage and dynamic code are forbidden");
    ts.forEachChild(n, inspect);
  }; inspect(source);
}
export async function measureHomeCarouselRuntime(dist: string, html: string, route: string) {
  const markup = inspectHomeCarouselMarkup(html, route);
  if (!markup.script) return { ...markup, homeCarouselAssets: [] };
  const bytes = await readFile(join(dist, markup.script.slice(1)));
  validateHomeCarouselSource(bytes.toString("utf8"));
  return { ...markup, homeCarouselAssets: [{ path: markup.script, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }] };
}
