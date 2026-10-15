import type { RegisteredToolRoute } from "./tool-runtime-policy.js";
import { readFile, realpath } from "node:fs/promises";
import { join, sep } from "node:path";
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

/** Existing bounded copy enhancement is not a framework/search island. */
export const measureCodeCopyRuntime = async (dist: string, html: string) => {
  const scripts: DefaultTreeAdapterTypes.Element[] = [];
  let codeBlocks = 0, duplicateAttribute = false;
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ("tagName" in node) {
      if (node.tagName === "script") scripts.push(node);
      if (node.tagName === "div" && node.attrs.some((a) => a.name === "data-code-block")
        && node.childNodes.some((child) => "tagName" in child && child.tagName === "pre"
          && child.childNodes.some((code) => "tagName" in code && code.tagName === "code"))) codeBlocks += 1;
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parse(html, { sourceCodeLocationInfo: true, onParseError: (error) => {
    if (error.code === "duplicate-attribute") duplicateAttribute = true;
  } }));
  const copies = scripts.filter((node) => node.attrs.some((a) =>
    a.name === "src" && new URL(a.value, "https://xpotato.net/").pathname === "/scripts/code-copy.js"));
  if (!copies.length) return { htmlWithoutCopy: html, codeCopyAssets: [] };
  const copy = copies[0]!, location = copy.sourceCodeLocation;
  if (copies.length !== 1 || !location || duplicateAttribute || codeBlocks === 0
    || copy.attrs.length !== 2 || !copy.attrs.some((a) => a.name === "src" && a.value === "/scripts/code-copy.js")
    || !copy.attrs.some((a) => a.name === "defer" && a.value === "") || copy.childNodes.length) {
    throw new Error("Copy enhancement requires one static fenced-code region and a deferred local script");
  }
  const path = "/scripts/code-copy.js", bytes = await readFile(join(dist, path.slice(1)));
  const gzipBytes = gzipSync(bytes).byteLength;
  if (bytes.length === 0 || bytes.length > 6000 || gzipBytes > 2500) throw new Error("Copy enhancement exceeds budget");
  const source = ts.createSourceFile(path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const inspect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node)
      || (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function")
      || (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && ["require", "eval", "Function"].includes(node.expression.text))
        || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "require")))) {
      throw new Error("Copy enhancement dependencies or dynamic code are forbidden");
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return { htmlWithoutCopy: html.slice(0, location.startOffset) + html.slice(location.endOffset),
    codeCopyAssets: [{ path, bytes: bytes.length, gzipBytes, sha256: sha256(bytes) }] };
};

const dependencyPath = (specifier: string, importer: string): string => {
  const url = new URL(specifier, "https://xpotato.net" + importer);
  if (url.origin !== "https://xpotato.net" || !/^\/_astro\/[^?#]+\.m?js$/u.test(url.pathname)
    || url.search || url.hash) throw new Error("Unexpected client dependency " + url.href);
  return url.pathname;
};

const moduleReferences = (source: string, importer: string): string[] => {
  const found = new Set<string>();
  const file = ts.createSourceFile(importer, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  // Generated client modules must be statically enumerable; never guess from ordinary strings.
  const inspect = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteralLike(node.moduleSpecifier)) throw new Error("Nonliteral module dependency");
      found.add(dependencyPath(node.moduleSpecifier.text, importer));
    }
    if (ts.isImportEqualsDeclaration(node)) throw new Error("Unsupported client import");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = node.arguments[0];
      if (node.arguments.length !== 1 || !specifier || !ts.isStringLiteralLike(specifier)) throw new Error("Nonliteral dynamic client import");
      found.add(dependencyPath(specifier.text, importer));
    }
    if (ts.isCallExpression(node) && ((ts.isIdentifier(node.expression) && node.expression.text === "require")
      || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "require"))) {
      throw new Error("Unsupported client require");
    }
    ts.forEachChild(node, inspect);
  };
  inspect(file);
  return [...found].sort();
};

const htmlReferences = (html: string): string[] => {
  const found = new Set<string>();
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ("tagName" in node) {
      const attr = (name: string) => node.attrs.find((item) => item.name === name)?.value;
      const roots = node.tagName === "script" ? [attr("src")]
        : node.tagName === "astro-island" ? [attr("component-url"), attr("renderer-url"), attr("before-hydration-url")]
        : node.tagName === "link" && attr("rel") === "modulepreload" ? [attr("href")] : [];
      for (const root of roots) if (root) found.add(dependencyPath(root, "/"));
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parse(html));
  return [...found].sort();
};

export const measureRouteRuntime = async (dist: string, route: string, html: string) => {
  const { htmlWithoutSharedMenu, sharedMenuAssets } = await measureSharedMenuRuntime(dist, html);
  const { htmlWithoutCopy, codeCopyAssets } = await measureCodeCopyRuntime(dist, htmlWithoutSharedMenu);
  const pending = htmlReferences(htmlWithoutCopy);
  const root = await realpath(dist);
  const assets = new Map<string, { path: string; bytes: number; gzipBytes: number; sha256: string }>();
  while (pending.length) {
    const path = pending.shift()!;
    if (assets.has(path)) continue;
    const localPath = await realpath(join(root, path.slice(1)));
    if (!localPath.startsWith(root + sep)) throw new Error("Runtime asset escaped dist");
    const bytes = await readFile(localPath);
    assets.set(path, { path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) });
    pending.push(...moduleReferences(bytes.toString("utf8"), path));
  }
  return {
    route,
    sharedMenuAssets,
    ...(codeCopyAssets.length ? { codeCopyAssets } : {}),
    islands: [...html.matchAll(/<astro-island\b/gu)].length,
    executableInlineScripts: [...html.matchAll(/<script\b([^>]*)>/gu)].filter((m) => !/type="application\/ld\+json"|\bsrc=/u.test(m[1]!)).length,
    assets: [...assets.values()].sort((a, b) => a.path < b.path ? -1 : 1),
  };
};

export const assertRuntimeIsolation = (
  observations: Awaited<ReturnType<typeof measureRouteRuntime>>[],
  tools: readonly RegisteredToolRoute[] = [],
) => {
  const search = observations.find((record) => record.route === "/search/");
  if (!search?.assets.length || search.islands || search.executableInlineScripts) throw new Error("Expected isolated search entrypoint missing");
  const searchAssets = new Set(search.assets.map((asset) => asset.path));
  const toolRoutes = new Set(tools.map((tool) => tool.route));
  for (const tool of tools) {
    const built = observations.find((record) => record.route === tool.route);
    if (!built || built.islands !== 1 || !built.assets.length) throw new Error("Registered Tool entrypoint missing: " + tool.route);
    if (built.assets.some((asset) => searchAssets.has(asset.path))) throw new Error("Search/React client graphs overlap");
  }
  for (const route of observations) {
    if (route === search || toolRoutes.has(route.route)) continue;
    if (route.islands || route.assets.length || route.executableInlineScripts) throw new Error("Client runtime leaked into " + route.route);
  }
};
