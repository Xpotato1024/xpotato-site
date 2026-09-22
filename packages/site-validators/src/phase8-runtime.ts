import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "@xpotato/content-contracts/canonical";

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
  const pending = references(html);
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
