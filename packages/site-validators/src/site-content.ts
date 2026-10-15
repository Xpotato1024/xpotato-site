import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { deriveContentCatalog, type CatalogSourceRecord } from "../../../apps/site/src/lib/catalog.js";
import { taxonomyRegistry } from "../../../apps/site/src/content-registry/taxonomy/index.js";
import { collectDemoModuleIds } from "./portable-mdx.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const readSiteContent = async () => {
  const sources: CatalogSourceRecord[] = [];
  const references = new Map<string, readonly string[]>();
  const walk = async (directory: string): Promise<string[]> => {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.isFile() && /\.mdx?$/u.test(path)) files.push(path);
    }
    return files.sort();
  };
  for (const collection of ["blog", "notes", "projects", "tools", "pages"] as const) {
    const directory = join(root, "apps/site/src/content", collection);
    for (const path of await walk(directory)) {
      const text = await readFile(path, "utf8");
      const match = /^---\r?\n([\s\S]+?)\r?\n---/u.exec(text);
      assert.ok(match, "Missing frontmatter " + path);
      const data = parseYaml(match[1]!) as CatalogSourceRecord["data"];
      const source = { collection, slug: relative(directory, path).replaceAll("\\", "/").replace(/\.mdx?$/u, ""), data } as CatalogSourceRecord;
      sources.push(source);
      references.set(data.id, collectDemoModuleIds(text.slice(match[0].length)));
    }
  }
  return { catalog: deriveContentCatalog(sources, taxonomyRegistry), references };
};
