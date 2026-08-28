import { describe, expect, it } from "vitest";
import { validateWorkspaceDependencies } from "./dependencies.js";
import { FROZEN_LEGACY_BASELINE, parseGitNameStatus, validateGitMediaAddition, validateGitMediaChange, validateLegacyRemoval } from "./git-media.js";
import { validatePortableMdx } from "./portable-mdx.js";
import { parseTaxonomyRegistry, requireTaxonomyId } from "./taxonomy.js";

describe("architecture conformance", () => {
  it("keeps site free of authoring, verifier, media, provider, and Pagefind dependencies", () => {
    expect(validateWorkspaceDependencies({ name: "@xpotato/site", dependencies: { "@xpotato/article-pipeline": "*" } })).not.toHaveLength(0);
    expect(validateWorkspaceDependencies({ name: "@xpotato/site", dependencies: { pagefind: "1" } })).not.toHaveLength(0);
  });

  it.each([
    "apps/site/public/article/photo.jpg",
    "public/new-legacy-neighbor/photo.jpg",
    "packages/example-verifier/fixture/screenshot.png",
    "apps/site/public/project/screenshot.png",
    "apps/site/public/hero.webp",
    "apps/site/public/ai/visual.avif",
    "apps/site/public/search/search-index.json",
    ".local/article-jobs/job/source.json",
  ])("rejects normal Git media/private additions: %s", (path) => {
    expect(validateGitMediaAddition(path).allowed).toBe(false);
  });

  it("allows deterministic SVG and explicit synthetic raster fixtures", () => {
    expect(validateGitMediaAddition("apps/site/public/icon.svg").allowed).toBe(true);
    expect(validateGitMediaAddition("tests/fixtures/synthetic-media/checker.png").allowed).toBe(true);
  });

  it("grandfathers only unchanged legacy raster bytes from the frozen baseline", () => {
    expect(FROZEN_LEGACY_BASELINE).toBe("c9535fdad2d2c9c30ea8d7201eb759ede7afa12e");
    expect(validateGitMediaChange({ kind: "M", path: "public/images/legacy-photo.jpg" }).allowed).toBe(false);
    expect(validateGitMediaChange({ kind: "R", previousPath: "public/images/legacy-photo.jpg", path: "public/images/renamed.jpg" }).allowed).toBe(false);
    expect(validateGitMediaChange({ kind: "D", path: "public/images/legacy-photo.jpg" }).allowed).toBe(true);
  });

  it("parses added, changed, and renamed diff fixtures repository-wide", () => {
    expect(parseGitNameStatus("A\toutside/new.png\nM\tpublic/legacy.jpg\nR100\told.webp\tnew.webp\n")).toEqual([
      { kind: "A", path: "outside/new.png" },
      { kind: "M", path: "public/legacy.jpg" },
      { kind: "R", previousPath: "old.webp", path: "new.webp" },
    ]);
  });

  it("blocks legacy removal until tag, inventory, and build prerequisites are all verified", () => {
    const removal = { kind: "D" as const, path: "src/pages/index.astro" };
    expect(validateLegacyRemoval(removal).allowed).toBe(false);
    expect(validateLegacyRemoval(removal, {
      immutableAnnotatedTagVerified: true,
      exactInventoryVerified: true,
      legacyBuildReproduced: true,
    }).allowed).toBe(true);
  });

  it.each([
    ["normal Markdown", "# 見出し\n\n本文 **強調**\n\n- item\n\n```ts\nexport const fixture = true;\n```"],
    ["Callout", "<Callout kind=\"note\">本文</Callout>"],
    ["Demo", "<Demo module=\"prime-factorizer\" />"],
    ["Figure", "<Figure asset=\"hero\" alt=\"説明\" />"],
  ])("accepts portable MDX with approved modules: %s", (_label, source) => {
    expect(validatePortableMdx(source)).toHaveLength(0);
  });

  it.each([
    "import Demo from '../../components/Demo.tsx'",
    "export const runtime = true",
    "<MyComponent />",
    "<div>raw HTML</div>",
    "<Demo client:load />",
    "<Demo moduleId=\"legacy-widget\" />",
    "<Figure assetId=\"legacy-image\" alt=\"x\" />",
    "![x](r2://bucket/key)",
    "![x](https://pub.example.r2.dev/media/v1/objects/sha256/aa/object.webp)",
    "<Callout kind={resolve('../../src/components/Callout.tsx')}>x</Callout>",
  ])("rejects non-portable MDX: %s", (source) => {
    expect(validatePortableMdx(source)).not.toHaveLength(0);
  });

  it("fails unknown taxonomy instead of silently creating a fallback", () => {
    const registry = parseTaxonomyRegistry({
      schemaVersion: 1,
      blogCategories: [{ id: "software", label: "Software", description: "Software", slug: "software", indexable: true, aliases: [], status: "active" }],
      noteSubjects: [],
      toolCategories: [],
      tags: [],
    });
    expect(() => requireTaxonomyId(registry, "blog", "unknown")).toThrow(/explicit proposal/);
  });
});
