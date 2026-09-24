import { describe, expect, it } from "vitest";
import { canonicalDistPath, compareUtf8Paths, createDeployArtifactManifest } from "./deploy-artifact-manifest.js";

const a = "a".repeat(64);
const b = "b".repeat(64);
const entries = [
  { relativePath: "tools/index.html", byteSize: 21, sha256: a },
  { relativePath: "_astro/client.js", byteSize: 17, sha256: b },
  { relativePath: "404.html", byteSize: 5, sha256: a },
] as const;

describe("vNext deploy tree manifest", () => {
  it("sorts UTF-8 paths before binary-framed SHA256 regardless of enumeration order", () => {
    const first = createDeployArtifactManifest(entries);
    const reverse = createDeployArtifactManifest([...entries].reverse());
    const rotated = createDeployArtifactManifest([entries[1]!, entries[2]!, entries[0]!]);
    expect(first).toEqual(reverse);
    expect(first).toEqual(rotated);
    expect(first.files.map((file) => file.relativePath)).toEqual([
      "404.html", "_astro/client.js", "tools/index.html",
    ]);
    expect(first.outputTreeSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("defines bytewise ordering independently of locale", () => {
    expect(compareUtf8Paths("_astro/a.js", "404.html")).toBeGreaterThan(0);
    expect(compareUtf8Paths("A", "a")).toBeLessThan(0);
    expect(compareUtf8Paths("z", "é")).toBeLessThan(0);
  });

  it("rejects path aliases, duplicates, malformed entries and ambiguous framing", () => {
    for (const path of ["", "./a", "a/../b", "a//b", "/a", "a\\b", "e\u0301"]) {
      expect(() => createDeployArtifactManifest([{ relativePath: path, byteSize: 1, sha256: a }])).toThrow();
    }
    expect(canonicalDistPath("a\\b")).toBe("a/b");
    expect(() => createDeployArtifactManifest([entries[0]!, entries[0]!])).toThrow(/Duplicate/u);
    expect(() => createDeployArtifactManifest([{ relativePath: "a", byteSize: -1, sha256: a }])).toThrow();
    expect(() => createDeployArtifactManifest([{ relativePath: "a", byteSize: 1, sha256: "bad" }])).toThrow();
    expect(createDeployArtifactManifest([{ relativePath: "a", byteSize: 12, sha256: a }]).outputTreeSha256)
      .not.toBe(createDeployArtifactManifest([{ relativePath: "a1", byteSize: 2, sha256: a }]).outputTreeSha256);
  });
});
