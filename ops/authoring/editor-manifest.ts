import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { taxonomyRegistry } from "../../content/registry/taxonomy/index.js";
import {
  semanticContentModulePropsSchemas,
  semanticContentModuleJsonSchemas,
} from "@xpotato/content-contracts/content";
import { interactiveModuleRegistry } from "../../content/registry/interactive/index.js";
export function editorManifest() {
  const active = (entries: readonly { id: string; status: string }[]) =>
    entries.filter((x) => x.status === "active").map((x) => x.id);
  const labels: Record<string, string> = {};
  for (const entries of [
    taxonomyRegistry.blogCategories,
    taxonomyRegistry.noteSubjects,
    taxonomyRegistry.toolCategories,
    taxonomyRegistry.tags,
  ])
    for (const term of entries)
      labels[term.id] =
        (term as { label?: string; name?: string }).label ??
        (term as { name?: string }).name ??
        term.id;
  const moduleSchemas = semanticContentModuleJsonSchemas();
  const value = {
    contractVersion: 1,
    categories: {
      blog: active(taxonomyRegistry.blogCategories),
      notes: active(taxonomyRegistry.noteSubjects),
      tools: active(taxonomyRegistry.toolCategories),
      projects: [],
      pages: [],
    },
    tags: active(taxonomyRegistry.tags),
    labels,
    modules: Object.keys(moduleSchemas),
    moduleSchemas,
    interactiveModules: Object.values(interactiveModuleRegistry).map((r) => ({
      id: r.id,
      allowedCollections: r.allowedCollections,
      status: r.status,
    })),
  };
  return {
    ...value,
    contractHash: createHash("sha256").update(JSON.stringify(moduleSchemas)).digest("hex"),
  };
}
export async function generateEditorManifest(check = false) {
  const target = new URL("../../content/registry/editor.json", import.meta.url),
    source = JSON.stringify(editorManifest(), null, 2) + "\n";
  if (check) {
    if ((await readFile(target, "utf8")) !== source) throw Error("EDITOR_MANIFEST_STALE");
  } else await writeFile(target, source);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await generateEditorManifest(process.argv.includes("--check"));
