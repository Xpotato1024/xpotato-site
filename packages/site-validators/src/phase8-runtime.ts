import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import * as ts from "typescript";
import { sha256 } from "@xpotato/content-contracts/canonical";

export const sharedMenuPath = "/scripts/mobile-menu.js" as const;

export const measureSharedMenuRuntime = async (dist: string, html: string) => {
  const scripts: DefaultTreeAdapterTypes.Element[] = [];
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ("tagName" in node && node.tagName === "script") scripts.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  let duplicateAttribute = false;
  visit(parse(html, { sourceCodeLocationInfo: true, onParseError: (error) => {
    if (error.code === "duplicate-attribute") duplicateAttribute = true;
  } }));
  const menus = scripts.filter((node) => {
    const src = node.attrs.find((attribute) => attribute.name === "src")?.value;
    return src !== undefined && new URL(src, "https://xpotato.net/").pathname === sharedMenuPath;
  });
  if (menus.length === 0) return { htmlWithoutSharedMenu: html, sharedMenuAssets: [] };
  if (menus.length !== 1) throw new Error("Shared menu must occur exactly once");
  const menu = menus[0]!;
  const location = menu.sourceCodeLocation;
  if (duplicateAttribute || !location || menu.attrs.length !== 2
    || menu.attrs.find((attribute) => attribute.name === "src")?.value !== sharedMenuPath
    || !menu.attrs.some((attribute) => attribute.name === "defer" && attribute.value === "")
    || menu.childNodes.length !== 0) throw new Error("Shared menu must be an empty same-origin defer classic script");
  const bytes = await readFile(join(dist, sharedMenuPath.slice(1)));
  const gzipBytes = gzipSync(bytes).byteLength;
  if (bytes.byteLength === 0 || bytes.byteLength > 2600 || gzipBytes > 1100) throw new Error("Shared menu exceeds its isolated budget");
  const source = ts.createSourceFile(sharedMenuPath, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const inspect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node)
      || (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function")
      || (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && ["require", "eval", "Function"].includes(node.expression.text))
        || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "require")))) {
      throw new Error("Shared menu dependencies or dynamic code are forbidden");
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return {
    htmlWithoutSharedMenu: html.slice(0, location.startOffset) + html.slice(location.endOffset),
    sharedMenuAssets: [{ path: sharedMenuPath, bytes: bytes.byteLength, gzipBytes, sha256: sha256(bytes) }],
  };
};

const references = (source: string, importer = "/"): string[] => {
  const found = new Set<string>();
  for (const pattern of [
    /(?:src|component-url|renderer-url|before-hydration-url)="([^"#]+\.js(?:\?[^"#]*)?)"/gu,
    /(?:from\s*|import\s*\(?|export[^;]*?from\s*)["']([^"']+\.js(?:\?[^"'#]*)?)["']/gu,
    /["'](\.\.?\/[^"']+\.js)["']/gu,
  ]) {
    for (const match of source.matchAll(pattern)) {
      const url = new URL(match[1]!, `https://xpotato.net${importer}`);
      if (url.origin !== "https://xpotato.net" || !url.pathname.startsWith("/_astro/")) throw new Error(`Unexpected client dependency ${url.href}`);
      found.add(url.pathname);
    }
  }
  return [...found].sort();
};

export const measureRouteRuntime = async (dist: string, route: string, html: string) => {
  const { htmlWithoutSharedMenu, sharedMenuAssets } = await measureSharedMenuRuntime(dist, html);
  const pending = references(htmlWithoutSharedMenu);
  const assets = new Map<string, { path: string; bytes: number; sha256: string }>();
  while (pending.length) {
    const path = pending.shift()!;
    if (assets.has(path)) continue;
    const bytes = await readFile(join(dist, path));
    assets.set(path, { path, bytes: bytes.length, sha256: sha256(bytes) });
    pending.push(...references(bytes.toString("utf8"), path));
  }
  return {
    route,
    sharedMenuAssets,
    islands: [...html.matchAll(/<astro-island\b/gu)].length,
    executableInlineScripts: [...html.matchAll(/<script\b([^>]*)>/gu)].filter((m) => !/type="application\/ld\+json"|\bsrc=/u.test(m[1]!)).length,
    assets: [...assets.values()].sort((a, b) => a.path < b.path ? -1 : 1),
  };
};

export const assertRuntimeIsolation = (observations: Awaited<ReturnType<typeof measureRouteRuntime>>[]) => {
  const search = observations.find((r) => r.route === "/search/");
  const tool = observations.find((r) => r.route === "/tools/prime-factorizer/");
  if (!search?.assets.length || search.islands || tool?.islands !== 1 || !tool.assets.length) throw new Error("Expected isolated search and React entrypoints missing");
  const searchAssets = new Set(search.assets.map((a) => a.path));
  if (tool.assets.some((a) => searchAssets.has(a.path))) throw new Error("Search/React client graphs overlap");
  for (const route of observations) {
    if (route === search || route === tool) continue;
    if (route.islands || route.assets.length || route.executableInlineScripts) throw new Error(`Client runtime leaked into ${route.route}`);
  }
};
