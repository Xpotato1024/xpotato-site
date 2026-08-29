import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareLegacyDistManifests, createLegacyDistManifest } from "./legacy-reproduction.js";

const writeFixture = async (root: string, reverse: boolean): Promise<void> => {
  const entries = [
    ["index.html", "home"],
    ["blog/a/index.html", "article"],
    ["404.html", "missing"],
    ["sitemap-index.xml", "sitemap"],
    ["robots.txt", "robots"],
  ] as const;
  for (const [path, contents] of reverse ? [...entries].reverse() : entries) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), contents, "utf8");
  }
};

describe("legacy build artifact manifest", () => {
  it("is deterministic across filesystem insertion order and changes for different bytes", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "xpotato-dist-test-"));
    const firstRoot = join(temporary, "first");
    const secondRoot = join(temporary, "second");
    try {
      await Promise.all([writeFixture(firstRoot, false), writeFixture(secondRoot, true)]);
      const [first, second] = await Promise.all([
        createLegacyDistManifest(firstRoot),
        createLegacyDistManifest(secondRoot),
      ]);
      expect(second.distManifestSha256).toBe(first.distManifestSha256);
      expect(second.endpointPathsSha256).toBe(first.endpointPathsSha256);
      expect(compareLegacyDistManifests(first, second)).toEqual([]);
      await writeFile(join(secondRoot, "index.html"), "changed", "utf8");
      const changed = await createLegacyDistManifest(secondRoot);
      expect(changed.distManifestSha256).not.toBe(first.distManifestSha256);
      expect(compareLegacyDistManifests(first, changed)).toEqual([
        expect.objectContaining({ path: "index.html" }),
      ]);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
