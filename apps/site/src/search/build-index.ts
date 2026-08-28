import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { SearchDocument } from "@xpotato/content-contracts";
import { searchDocumentSchema } from "@xpotato/content-contracts";
import { createSearchIndex } from "./config.js";
import { tokenizeCjkSingles } from "./tokenizer.js";

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (match) => match.slice(1))), "../..");
const dist = resolve(root, "dist");
const decode = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim());
const attribute = (tag: string, name: string): string | undefined => new RegExp(`${name}="([^"]*)"`, "u").exec(tag)?.[1];
const walk = async (directory: string): Promise<string[]> => {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (entry.name.endsWith(".html")) output.push(path);
  }
  return output;
};

const documents: SearchDocument[] = [];
for (const path of await walk(dist)) {
  const html = await readFile(path, "utf8");
  if (/<meta\s+name="robots"\s+content="noindex"/iu.test(html)) continue;
  const match = /(<main\b[^>]*data-search-body[^>]*>)([\s\S]*?)<\/main>/iu.exec(html);
  if (!match?.[1] || match[2] === undefined) continue;
  const route = `/${relative(dist, path).replaceAll("\\", "/").replace(/index\.html$/u, "")}`;
  const bodyText = text(match[2]);
  const headingText = text([...match[2].matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/giu)].map((item) => item[1]).join(" "));
  documents.push(searchDocumentSchema.parse({
    id: attribute(match[1], "data-search-id"),
    route,
    collection: attribute(match[1], "data-search-collection"),
    title: decode(attribute(match[1], "data-search-title") ?? ""),
    description: decode(attribute(match[1], "data-search-description") ?? ""),
    taxonomyText: decode(attribute(match[1], "data-search-taxonomy") ?? ""),
    headingText,
    bodyText,
    cjkSingles: tokenizeCjkSingles(`${headingText} ${bodyText}`).join(" "),
  }));
}
documents.sort((left, right) => left.id.localeCompare(right.id));
const index = createSearchIndex();
index.addAll(documents);
const output = resolve(dist, "search/search-index.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(index)}\n`, "utf8");
console.log(`Search index PASS: ${documents.length} documents -> ${relative(root, output)}`);
