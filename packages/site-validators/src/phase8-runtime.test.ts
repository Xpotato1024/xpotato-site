import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sha256 } from "@xpotato/content-contracts/canonical";
import { phase7InteractiveReadinessManifestSchema } from "@xpotato/content-contracts";
import { assertRuntimeIsolation, measureRouteRuntime, measureSharedMenuRuntime } from "./phase8-runtime.js";

const menu = '<script src="/scripts/mobile-menu.js" defer></script>';
const withDist = async (run: (dist: string) => Promise<void>, source = '(()=>{document.querySelector("button");})();') => {
  const dist = await mkdtemp(join(tmpdir(), "phase-runtime-"));
  try {
    await mkdir(join(dist, "scripts"));
    await mkdir(join(dist, "_astro"));
    await writeFile(join(dist, "scripts/mobile-menu.js"), source);
    await writeFile(join(dist, "_astro/search.js"), "void 0;");
    await writeFile(join(dist, "_astro/tool.js"), "void 1;");
    await run(dist);
  } finally { await rm(dist, { recursive: true, force: true }); }
};

describe("isolated shared menu runtime", () => {
  it("measures actual bytes/gzip/hash separately from static route assets", async () => {
    await withDist(async (dist) => {
      const bytes = await readFile(join(dist, "scripts/mobile-menu.js"));
      const runtime = await measureRouteRuntime(dist, "/", menu);
      expect(runtime.assets).toEqual([]);
      expect(runtime.sharedMenuAssets).toEqual([{ path: "/scripts/mobile-menu.js",
        bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }]);
      expect(runtime.executableInlineScripts).toBe(0);
    });
  });

  it("keeps search/tool graphs disjoint and held content free of route-specific JS", async () => {
    await withDist(async (dist) => {
      const routes = await Promise.all([
        measureRouteRuntime(dist, "/search/", menu + '<script src="/_astro/search.js"></script>'),
        measureRouteRuntime(dist, "/tools/prime-factorizer/", menu + '<astro-island component-url="/_astro/tool.js"></astro-island>'),
        measureRouteRuntime(dist, "/blog/held-fixture/", menu),
      ]);
      expect(() => assertRuntimeIsolation(routes)).not.toThrow();
      const tool = routes[1]!;
      tool.assets = routes[0]!.assets;
      expect(() => assertRuntimeIsolation(routes)).toThrow("overlap");
    });
  });

  it.each([
    menu + menu,
    '<script src="/scripts/mobile-menu.js" async></script>',
    '<script src="/scripts/mobile-menu.js" defer type="module"></script>',
    '<script src="/scripts/mobile-menu.js?v=1" defer></script>',
    '<script src="https://other.invalid/scripts/mobile-menu.js" defer></script>',
    '<script src="/scripts/mobile-menu.js" defer defer></script>',
    '<script src="/scripts/mobile-menu.js" defer>void 0;</script>',
  ])("rejects duplicate/alias/inline/attribute drift: %s", async (html) => {
    await withDist(async (dist) => { await expect(measureRouteRuntime(dist, "/", html)).rejects.toThrow(); });
  });

  it.each(['import "other";', 'import("other")', 'require("other")',
    'module.require("other")', 'export * from "other";', 'new Function("return 0")'])(
    "rejects dependencies/dynamic code in menu: %s", async (source) => {
      await withDist(async (dist) => {
        await expect(measureSharedMenuRuntime(dist, menu)).rejects.toThrow("forbidden");
      }, source);
    });

  it("rejects unknown external JS, menu imported by tool, budget overflow and static leakage", async () => {
    await withDist(async (dist) => {
      await expect(measureRouteRuntime(dist, "/", menu + '<script src="/scripts/unknown.js"></script>')).rejects.toThrow();
      await writeFile(join(dist, "_astro/tool.js"), 'import "/scripts/mobile-menu.js";');
      await expect(measureRouteRuntime(dist, "/tools/prime-factorizer/", menu + '<astro-island component-url="/_astro/tool.js"></astro-island>')).rejects.toThrow();
      await writeFile(join(dist, "scripts/mobile-menu.js"), " ".repeat(2601));
      await expect(measureSharedMenuRuntime(dist, menu)).rejects.toThrow("budget");
    });
  });

  it("accepts historical absence without inventing measurements or rewriting its manifest", async () => {
    await withDist(async (dist) => {
      expect((await measureRouteRuntime(dist, "/", "<main>historical</main>")).sharedMenuAssets).toEqual([]);
    });
    const raw = await readFile(new URL("../../../docs/migration/phase7-interactive-readiness-v1.json", import.meta.url), "utf8");
    const historical = phase7InteractiveReadinessManifestSchema.parse(JSON.parse(raw));
    expect(historical.runtimeIsolation.sharedMenuAssets).toBeUndefined();
    expect(historical.runtimeIsolation.contentOnlyRoutes.every((route) => route.sharedMenuAssets === undefined)).toBe(true);
  });
});
