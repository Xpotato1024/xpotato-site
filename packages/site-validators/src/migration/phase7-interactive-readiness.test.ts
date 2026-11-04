import { describe, expect, it } from "vitest";
import type { Phase7InteractiveReadinessManifest } from "@xpotato/content-contracts";
import { phase7InteractiveGateProjection } from "./phase7-interactive-readiness.js";

const manifest = (componentHash: string, htmlHash: string, initialVisibleOutput = "360 = 2 × 2 × 2 × 3 × 3 × 5"): Phase7InteractiveReadinessManifest => ({
  manifestPayloadSha256: "a".repeat(64),
  legacyAuthority: {
    generatedBuildObservation: {
      node: "24.19.0",
      npm: "11.19.0",
      route: "/tools/prime-factorizer/",
      rawHtmlSha256: htmlHash,
      astroIslandClient: "visible",
      ssrShell: true,
      initialInputValue: "360",
      initialVisibleOutput: "360 = 2 × 2 × 2 × 3 × 3 × 5",
      componentAsset: { path: `/_astro/PrimeFactorizer.${componentHash}.js`, bytes: 100, sha256: componentHash },
      rendererAsset: { path: "/_astro/client.old.js", bytes: 100, sha256: "b".repeat(64) },
      acceptedNonHtmlManifestSha256: "c".repeat(64),
    },
  },
  runtimeIsolation: {
    toolRoute: "/tools/prime-factorizer/",
    toolHtmlPath: "tools/prime-factorizer/index.html",
    toolAstroIslandCount: 1,
    toolExecutableInlineScriptBytes: 400,
    routeClientJsAssets: [{ path: `/_astro/PrimeFactorizer.${componentHash}.js`, bytes: 100, gzipBytes: 50, sha256: componentHash }],
    routeClientJsRawBytes: 100,
    routeClientJsGzipBytes: 50,
    primeFactorizerChunk: { path: `/_astro/PrimeFactorizer.${componentHash}.js`, bytes: 100, gzipBytes: 50, sha256: componentHash },
    reactRuntimeChunk: { path: "/_astro/client.old.js", bytes: 100, gzipBytes: 50, sha256: "b".repeat(64) },
    supportingChunks: [],
    contentOnlyRoutes: [],
    unbuiltContentOnlyRouteClasses: [],
  },
  observableBehavior: { initialVisibleOutput },
} as unknown as Phase7InteractiveReadinessManifest);

describe("Phase 7 normal readiness comparison", () => {
  it("does not block on historical HTML, asset identity, size, or manifest hashes", () => {
    expect(phase7InteractiveGateProjection(manifest("d".repeat(64), "e".repeat(64))))
      .toEqual(phase7InteractiveGateProjection(manifest("f".repeat(64), "0".repeat(64))));
  });

  it("keeps historical snapshots comparable while live menu measurements remain separate", () => {
    const old = manifest("d".repeat(64), "e".repeat(64));
    const current = structuredClone(old);
    const route = { id: "home", route: "/", htmlPath: "index.html", astroIslandCount: 0 as const,
      executableInlineScriptBytes: 0, clientJsAssets: [] };
    old.runtimeIsolation.contentOnlyRoutes = [route];
    current.runtimeIsolation.contentOnlyRoutes = [{ ...route, sharedMenuAssets: [{
      path: "/scripts/mobile-menu.js", bytes: 1800, gzipBytes: 700, sha256: "1".repeat(64),
    }] }];
    current.runtimeIsolation.sharedMenuAssets = current.runtimeIsolation.contentOnlyRoutes[0]!.sharedMenuAssets;
    expect(phase7InteractiveGateProjection(current)).toEqual(phase7InteractiveGateProjection(old));
  });

  it("continues to compare the visible behavior contract", () => {
    expect(phase7InteractiveGateProjection(manifest("d".repeat(64), "e".repeat(64), "changed")))
      .not.toEqual(phase7InteractiveGateProjection(manifest("d".repeat(64), "e".repeat(64))));
  });
});
