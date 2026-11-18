import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { taxonomyRegistry } from "../../content/registry/taxonomy/index.js";
import {
  semanticContentModuleJsonSchemas,
  taxonomyRegistrySchema,
  type TaxonomyRegistry,
} from "@xpotato/content-contracts/content";
import { collectionDirectories, parseDraft } from "@xpotato/editor-core/draft";
import {
  parseEditorContentIndex,
  taxonomySnapshotFields,
  type EditorContentRecord,
} from "@xpotato/editor-core/registry";
import type { ContentCollection } from "@xpotato/content-contracts/common";
import { interactiveModuleRegistry } from "../../content/registry/interactive/index.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Safe to bundle into the editor: never include draft titles, IDs, or series membership here. */
export function editorManifest(terms: TaxonomyRegistry = taxonomyRegistry) {
  const moduleSchemas = semanticContentModuleJsonSchemas();
  return {
    contractVersion: 1,
    ...taxonomySnapshotFields(terms),
    modules: Object.keys(moduleSchemas),
    moduleSchemas,
    interactiveModules: Object.values(interactiveModuleRegistry).map((record) => ({
      id: record.id,
      allowedCollections: record.allowedCollections,
      status: record.status,
    })),
    contractHash: createHash("sha256").update(JSON.stringify(moduleSchemas)).digest("hex"),
  };
}

/** Read only by the authenticated API. Keeping it separate prevents private content in public JS. */
export async function editorContentIndex(root = repositoryRoot) {
  const documents: EditorContentRecord[] = [];
  for (const [collection, directory] of Object.entries(collectionDirectories)) {
    const base = join(root, "content", directory);
    for (const file of await readdir(base, { withFileTypes: true })) {
      if (!file.isFile() || !/\.mdx?$/u.test(file.name)) continue;
      const { data } = parseDraft(await readFile(join(base, file.name), "utf8"));
      documents.push({
        contentId: data.id,
        path: "content/" + directory + "/" + file.name,
        title: data.title,
        collection: collection as ContentCollection,
      });
    }
  }
  documents.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return parseEditorContentIndex({ schemaVersion: 1, documents });
}

export async function generateEditorManifest(check = false, root = repositoryRoot) {
  const terms = taxonomyRegistrySchema.parse(
    JSON.parse(await readFile(join(root, "content/registry/taxonomy/terms.json"), "utf8")),
  );
  const files = [
    [join(root, "content/registry/editor.json"), editorManifest(terms)],
    [join(root, "content/registry/editor-content-index.json"), await editorContentIndex(root)],
  ] as const;
  for (const [target, value] of files) {
    const source = JSON.stringify(value, null, 2) + "\n";
    if (check) {
      if ((await readFile(target, "utf8")) !== source)
        throw Error("EDITOR_MANIFEST_STALE: " + target);
    } else await writeFile(target, source);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await generateEditorManifest(process.argv.includes("--check"));
