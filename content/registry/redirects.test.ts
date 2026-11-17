import { describe, expect, it } from "vitest";
import { applicationRedirects, currentApplicationRedirects, redirectArtifact } from "./redirects.js";
import { taxonomyRegistry } from "./taxonomy/index.js";
import { deriveContentCatalog } from "../../apps/site/src/features/discovery/model/catalog.js";
import { generateArchivePages } from "../../apps/site/src/features/discovery/model/discovery.js";

const sourcePath = "/articles/category/3d-printing/";
const targetPath = "/articles/tag/3d-printing/";

describe("retired 3D-printing category compatibility", () => {
  it("emits one permanent redirect directly to the technical tag", () => {
    const matches = applicationRedirects.filter((record) => record.sourcePath === sourcePath);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ targetPath, status: 301, statusLifecycle: "active" });
    expect(redirectArtifact().split("\n").filter((line) => line.startsWith(sourcePath + " ")))
      .toEqual([`${sourcePath} ${targetPath} 301`]);
  });

  it("targets a generated archive without a redirect chain or obsolete category page", () => {
    const catalog = deriveContentCatalog([{
      collection: "blog", slug: "printer-fixture",
      data: { id: "bca48f98-c89a-457f-84d8-168f941fe469", title: "Printer", description: "Fixture",
        pubDate: "2026-11-16", category: "making", tags: ["3d-printing", "fdm"], draft: false },
    }], taxonomyRegistry);
    const routes = generateArchivePages(catalog.map((entry) => entry.discoveryRecord), taxonomyRegistry).map((page) => page.route);
    expect(routes).toContain(targetPath);
    expect(routes).not.toContain(sourcePath);
    const redirects = currentApplicationRedirects(catalog);
    expect(redirects.filter((record) => record.sourcePath === sourcePath)).toHaveLength(1);
    expect(redirects.some((record) => record.sourcePath === targetPath)).toBe(false);
  });
});
