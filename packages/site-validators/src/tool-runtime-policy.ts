import { browserToolReleases } from "../../../apps/site/src/content-registry/interactive/releases.js";
import { validateToolReleaseBindings } from "./browser-tool-bindings.js";
import { verifyToolPin } from "./browser-tool-adoption.js";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import type { InteractiveModuleRecord, ToolBindingRecord } from "@xpotato/content-contracts";
import type { DerivedCatalogEntry } from "../../../apps/site/src/lib/catalog.js";
import { interactiveModuleRegistry, toolBindings } from "../../../apps/site/src/content-registry/interactive/index.js";
import { interactiveComponentIds } from "../../../apps/site/src/content-registry/interactive/component-ids.js";
import { readSiteContent } from "./site-content.js";

export interface RegisteredToolRoute {
  readonly route: string;
  readonly contentId: string;
  readonly moduleId: string;
  readonly componentId: string;
  readonly hydration: InteractiveModuleRecord["hydration"];
}
export const deriveRegisteredToolRoutes = (
  catalog: readonly DerivedCatalogEntry[],
  references: ReadonlyMap<string, readonly string[]>,
  modules: Readonly<Record<string, InteractiveModuleRecord>>,
  bindings: readonly ToolBindingRecord[],
  componentIds: readonly string[],
): readonly RegisteredToolRoute[] => {
  const routes: RegisteredToolRoute[] = [];
  for (const entry of catalog.filter((item) => item.disposition === "published")) {
    const id = entry.routeRecord.contentId;
    const ids = references.get(id) ?? [];
    if (entry.routeRecord.collection !== "tools") {
      assert.equal(ids.length, 0, "Initial Tool runtime is restricted to Tools routes");
      continue;
    }
    const active = bindings.filter((binding) => binding.contentId === id && binding.status === "active" && binding.role === "primary_tool");
    assert.equal(active.length, 1, "Published Tool requires one active primary binding");
    const moduleId = active[0]!.moduleId;
    assert.deepEqual(ids, [moduleId], "Tool content must reference exactly its primary module");
    const module = modules[moduleId];
    assert.ok(module && module.id === moduleId && module.status === "active" && module.framework === "react"
      && module.role === "primary_tool" && module.allowedCollections.includes("tools"), "Unregistered/inactive Tool module");
    assert.ok(componentIds.includes(module.componentId), "Tool component import is not registered");
    assert.ok(["load", "idle", "visible", "media"].includes(module.hydration), "Unknown hydration capability");
    routes.push({ route: entry.routeRecord.route, contentId: id, moduleId, componentId: module.componentId, hydration: module.hydration });
  }
  assert.equal(new Set(routes.map((item) => item.route)).size, routes.length, "Duplicate Tool route");
  return routes.sort((a, b) => a.route < b.route ? -1 : 1);
};
export const readRegisteredToolRoutes = async () => {
  validateToolReleaseBindings(interactiveModuleRegistry,browserToolReleases);
  for(const pin of browserToolReleases) await verifyToolPin(fileURLToPath(new URL("../../../vendor/browser-tools/",import.meta.url)),pin);
  const { catalog, references } = await readSiteContent();
  return deriveRegisteredToolRoutes(catalog, references, interactiveModuleRegistry, toolBindings, interactiveComponentIds);
};

/** Validate the actual island/semantic binding before admitting a generated asset graph. */
export const validateRegisteredToolHtml = (path: string, html: string, tools: readonly RegisteredToolRoute[]): readonly string[] => {
  const route = "/" + path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/index\.html$/u, "");
  const tool = tools.find((item) => item.route === route);
  const modules: string[] = [];
  const islands: DefaultTreeAdapterTypes.Element[] = [];
  const errors: string[] = [];
  const attr = (node: DefaultTreeAdapterTypes.Element, name: string) => node.attrs.find((item) => item.name === name)?.value;
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ("tagName" in node) {
      const module = attr(node, "data-interactive-module");
      if (module !== undefined) modules.push(module);
      if (node.tagName === "astro-island") islands.push(node);
    }
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parse(html, { onParseError: (error) => { if (error.code === "duplicate-attribute") errors.push("Duplicate HTML attribute"); } }));
  if (!tool) {
    if (modules.length || islands.length) errors.push("Unregistered island or module on " + route);
    return errors;
  }
  if (JSON.stringify(modules) !== JSON.stringify([tool.moduleId]) || islands.length !== 1) errors.push("Tool HTML requires its one registry module/island");
  for (const island of islands) {
    if (attr(island, "client") !== tool.hydration || attr(island, "component-export") !== "default") errors.push("Tool island hydration/export differs from registry");
    for (const key of ["component-url", "renderer-url"]) {
      if (!/^\/_astro\/[A-Za-z0-9._~-]+\.m?js$/u.test(attr(island, key) ?? "")) errors.push("Tool island requires local generated " + key);
    }
  }
  return errors;
};
