import { describe, expect, it } from "vitest";
import { validateWorkspaceDependencies } from "./dependencies.js";
import { validateGitMediaAddition } from "./git-media.js";
import { validatePortableMdx } from "./portable-mdx.js";
import { parseTaxonomyRegistry, requireTaxonomyId } from "./taxonomy.js";

describe("architecture conformance", () => {
  it("keeps site free of authoring, verifier, media, provider, and Pagefind dependencies", () => {
    expect(validateWorkspaceDependencies({ name: "@xpotato/site", dependencies: { "@xpotato/article-pipeline": "*" } })).not.toHaveLength(0);
    expect(validateWorkspaceDependencies({ name: "@xpotato/site", dependencies: { pagefind: "1" } })).not.toHaveLength(0);
  });

  it.each([
    "apps/site/public/article/photo.jpg",
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

  it.each([
    "import Demo from '../../components/Demo.tsx'",
    "<Demo client:load />",
    "![x](r2://bucket/key)",
    "<div class=\"grid-cols-[1fr_2fr]\">",
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
