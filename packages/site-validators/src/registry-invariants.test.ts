import { describe, expect, it } from "vitest";
import type { TaxonomyRegistry } from "@xpotato/content-contracts";
import { validateRegistryInvariants, type RegistryInvariantInput } from "./registry-invariants.js";

const blogId = "f8a847d4-8f5d-4bb0-a387-750f096479f2";
const toolId = "90af3222-b287-412f-99eb-fcd9ee92a579";
const projectId = "6691a53d-396a-4c23-a4b8-496c83db0d76";
const taxonomy: TaxonomyRegistry = {
  schemaVersion: 1,
  blogCategories: [{ id: "software", label: "Software", description: "Software", slug: "software", indexable: true, aliases: [], status: "active" }],
  noteSubjects: [],
  toolCategories: [{ id: "calculation", label: "Calculation", description: "Calculation", slug: "calculation", indexable: true, aliases: [], status: "active" }],
  tags: [
    { id: "astro", label: "Astro", slug: "astro", kind: "technology", aliases: ["astro-js"], archive: true, indexable: true, status: "active" },
    { id: "static-site", label: "Static site", slug: "static-site", kind: "topic", aliases: [], archive: true, indexable: true, status: "active" },
    { id: "retired-tag", label: "Retired", slug: "retired-tag", kind: "topic", aliases: [], archive: false, indexable: false, status: "retired" },
  ],
};

const valid = (): RegistryInvariantInput => ({
  contents: [
    { contentId: blogId, collection: "blog", route: "/blog/fixture/", draft: false, categoryId: "software", tagIds: ["astro"], stackIds: [], interactiveModuleIds: [] },
    { contentId: toolId, collection: "tools", route: "/tools/fixture/", draft: false, toolCategoryId: "calculation", tagIds: [], stackIds: [], interactiveModuleIds: ["prime-factorizer"] },
    { contentId: projectId, collection: "projects", route: "/projects/fixture/", draft: false, tagIds: ["astro"], stackIds: ["astro"], interactiveModuleIds: [] },
  ],
  mediaRegistries: [{ contentId: blogId, assets: [{ role: "hero", status: "active" }, { role: "social_card", status: "active" }] }],
  provenanceContentIds: [blogId, toolId],
  taxonomy,
  interactiveModules: {
    "prime-factorizer": {
      id: "prime-factorizer",
      framework: "react",
      componentId: "prime-factorizer-react-v1",
      hydration: "visible",
      allowedCollections: ["tools"],
      role: "primary_tool",
      status: "active",
      apiVersion: 1,
      budgetClass: "small",
    },
  },
  toolBindings: [{ contentId: toolId, moduleId: "prime-factorizer", role: "primary_tool", status: "active" }],
  interactiveComponentIds: ["prime-factorizer-react-v1"],
  contentModules: ["Figure", "Gallery", "Callout", "Steps", "Step", "Comparison", "LinkCard", "Details", "Demo"].map((id) => ({
    id,
    status: "active" as const,
    allowedCollections: ["blog", "notes", "projects", "tools", "pages"] as const,
  })),
});

describe("global content and registry invariants", () => {
  it("accepts a globally consistent registry snapshot", () => {
    expect(validateRegistryInvariants(valid())).toEqual([]);
  });

  it("rejects global ContentId and route duplicates", () => {
    const input = valid();
    const duplicate = { ...input.contents[0]!, route: input.contents[1]!.route };
    const errors = validateRegistryInvariants({ ...input, contents: [...input.contents, duplicate] });
    expect(errors.join("\n")).toMatch(/ContentId duplicate/);
    expect(errors.join("\n")).toMatch(/route duplicate/);
  });

  it("rejects unresolved Media Registry, provenance, and interactive ContentIds", () => {
    const input = valid();
    const unknownId = "20ac6088-f821-4d62-a368-f93487a240a5";
    const errors = validateRegistryInvariants({
      ...input,
      mediaRegistries: [{ contentId: unknownId, assets: [] }],
      provenanceContentIds: [unknownId],
      toolBindings: [{ ...input.toolBindings[0]!, contentId: unknownId }],
    });
    expect(errors.join("\n")).toMatch(/Media Registry ContentId does not resolve/);
    expect(errors.join("\n")).toMatch(/provenance ContentId does not resolve/);
    expect(errors.join("\n")).toMatch(/interactive binding ContentId does not resolve/);
  });

  it("rejects taxonomy alias ambiguity and retired terms", () => {
    const input = valid();
    const ambiguousTaxonomy: TaxonomyRegistry = {
      ...input.taxonomy,
      tags: [
        ...input.taxonomy.tags,
        { id: "astro-alt", label: "Astro Alt", slug: "astro-alt", kind: "technology", aliases: ["astro-js"], archive: true, indexable: true, status: "active" },
      ],
    };
    const contents = input.contents.map((content, index) => index === 0 ? { ...content, tagIds: ["retired-tag"] } : content);
    const errors = validateRegistryInvariants({ ...input, taxonomy: ambiguousTaxonomy, contents });
    expect(errors.join("\n")).toMatch(/alias ambiguity/);
    expect(errors.join("\n")).toMatch(/unknown or retired/);
  });

  it("rejects Project stack references to non-technology tags", () => {
    const input = valid();
    const contents = input.contents.map((content) => content.contentId === projectId ? { ...content, stackIds: ["static-site"] } : content);
    expect(validateRegistryInvariants({ ...input, contents }).join("\n")).toMatch(/active technology tag/);
  });

  it("rejects missing or duplicate active Tool primary bindings", () => {
    const input = valid();
    expect(validateRegistryInvariants({ ...input, toolBindings: [] }).join("\n")).toMatch(/exactly one active primary binding/);
    expect(validateRegistryInvariants({ ...input, toolBindings: [input.toolBindings[0]!, input.toolBindings[0]!] }).join("\n")).toMatch(/exactly one active primary binding/);
  });

  it("rejects missing component imports and collection-incompatible modules", () => {
    const input = valid();
    expect(validateRegistryInvariants({ ...input, interactiveComponentIds: [] }).join("\n")).toMatch(/component import missing/);
    const modules = { "prime-factorizer": { ...input.interactiveModules["prime-factorizer"]!, allowedCollections: ["blog" as const] } };
    expect(validateRegistryInvariants({ ...input, interactiveModules: modules }).join("\n")).toMatch(/collection mismatch|role\/collection mismatch/);
  });

  it("rejects missing and duplicate published Blog hero/social assets", () => {
    const input = valid();
    expect(validateRegistryInvariants({ ...input, mediaRegistries: [{ contentId: blogId, assets: [] }] }).join("\n")).toMatch(/exactly one active hero.*exactly one active social_card/s);
    const duplicate = { contentId: blogId, assets: [
      { role: "hero", status: "active" as const }, { role: "hero", status: "active" as const },
      { role: "social_card", status: "active" as const }, { role: "social_card", status: "active" as const },
    ] };
    expect(validateRegistryInvariants({ ...input, mediaRegistries: [duplicate] }).join("\n")).toMatch(/exactly one active hero.*exactly one active social_card/s);
  });
});
