import { describe, expect, it } from "vitest";
import { interactiveModuleRecordSchema } from "@xpotato/content-contracts";
import { deriveContentCatalog, type CatalogSourceRecord } from "../../../apps/site/src/lib/catalog.js";
import { taxonomyRegistry } from "../../../apps/site/src/content-registry/taxonomy/index.js";
import { deriveRegisteredToolRoutes } from "./tool-runtime-policy.js";
import { collectDemoModuleIds } from "./portable-mdx.js";

const content = (id: string, slug: string): CatalogSourceRecord => ({
  collection: "tools", slug,
  data: { id, title: "人工tool", description: "fixture", pubDate: "2026-10-15", category: "math", tags: [], draft: false },
});
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const catalog = deriveContentCatalog(ids.map((id, i) => content(id, "tool-" + i)), taxonomyRegistry);
const modules = Object.fromEntries(ids.map((_, i) => ["module-" + i, interactiveModuleRecordSchema.parse({
  id: "module-" + i, framework: "react", componentId: "component-" + i,
  hydration: i ? "idle" : "visible", allowedCollections: ["tools"], role: "primary_tool", status: "active", apiVersion: 1, budgetClass: "small",
})]));
const references = new Map(ids.map((id, i) => [id, ["module-" + i]]));
const bindings = ids.map((contentId, i) => ({ contentId, moduleId: "module-" + i, role: "primary_tool" as const, status: "active" as const }));
const components = ["component-0", "component-1"];

describe("registry-derived route capability admission", () => {
  it("derives two routes from active content/bindings with per-module hydration", () => {
    expect(deriveRegisteredToolRoutes(catalog, references, modules, bindings, components)
      .map((tool) => [tool.route, tool.moduleId, tool.hydration]))
      .toEqual([["/tools/tool-0/", "module-0", "visible"], ["/tools/tool-1/", "module-1", "idle"]]);
  });
  it("rejects missing/duplicate bindings, retired modules, missing imports and mismatched declarations", () => {
    expect(() => deriveRegisteredToolRoutes(catalog, references, modules, bindings.slice(1), components)).toThrow("one active");
    expect(() => deriveRegisteredToolRoutes(catalog, references, modules, [...bindings, bindings[0]!], components)).toThrow("one active");
    expect(() => deriveRegisteredToolRoutes(catalog, references, { ...modules, "module-0": { ...modules["module-0"]!, status: "retired" } }, bindings, components)).toThrow("inactive");
    expect(() => deriveRegisteredToolRoutes(catalog, references, modules, bindings, [])).toThrow("import");
    expect(() => deriveRegisteredToolRoutes(catalog, new Map([[ids[0]!, ["unknown"]]]), modules, bindings, components)).toThrow("exactly");
    expect(() => interactiveModuleRecordSchema.parse({ ...modules["module-0"], hydration: "worker" })).toThrow();
    expect(() => interactiveModuleRecordSchema.parse({ ...modules["module-0"], framework: "iframe" })).toThrow();
  });
  it("ignores draft Tools and rejects runtime references in other collections", () => {
    const draft = { ...catalog[0]!, disposition: "held_candidate" as const };
    expect(deriveRegisteredToolRoutes([draft], references, modules, [], [])).toEqual([]);
    const article = { ...catalog[0]!, routeRecord: { ...catalog[0]!.routeRecord, collection: "blog" as const } };
    expect(() => deriveRegisteredToolRoutes([article], references, modules, bindings, components)).toThrow("restricted");
  });
  it("reads semantic AST declarations rather than fenced examples and rejects expressions", () => {
    expect(collectDemoModuleIds('```mdx\n<Demo module="fake" />\n```\n\n<Demo module="module-0" />')).toEqual(["module-0"]);
    expect(() => collectDemoModuleIds("<Demo module={unknown} />")).toThrow();
  });
});
