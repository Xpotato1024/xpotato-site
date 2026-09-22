import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { SearchDocument } from "@xpotato/content-contracts";
import { buildSearchDocumentsFromHtmlPages, type SearchHtmlPage } from "./html.js";
import { createSearchIndexFromDocuments, serializeSearchIndex } from "./runtime.js";

const defaultDistRoot = fileURLToPath(new URL("../../dist", import.meta.url));

const walkHtmlFiles = async (directory: string): Promise<string[]> => {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walkHtmlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".html")) output.push(path);
  }
  return output.sort();
};

export const routeFromDistHtmlPath = (distRoot: string, htmlPath: string): string => {
  const relativePath = relative(resolve(distRoot), resolve(htmlPath));
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`HTML path must be below dist root: ${htmlPath}`);
  }
  const normalizedPath = relativePath.split(sep).join("/");
  if (normalizedPath === "index.html") return "/";
  if (normalizedPath.endsWith("/index.html")) return `/${normalizedPath.slice(0, -"index.html".length)}`;
  return `/${normalizedPath}`;
};

export const extractSearchDocumentsFromDist = async (distRoot: string): Promise<SearchDocument[]> => {
  const pages: SearchHtmlPage[] = [];
  for (const path of await walkHtmlFiles(distRoot)) {
    pages.push({ route: routeFromDistHtmlPath(distRoot, path), html: await readFile(path, "utf8") });
  }
  return buildSearchDocumentsFromHtmlPages(pages);
};

export type BuiltSearchIndex = Readonly<{
  documents: SearchDocument[];
  index: ReturnType<typeof createSearchIndexFromDocuments>;
  outputPath: string;
}>;

/** Builds the production index from rendered HTML without running as a side effect on import. */
export const buildSearchIndex = async (distRoot: string = defaultDistRoot): Promise<BuiltSearchIndex> => {
  const documents = await extractSearchDocumentsFromDist(distRoot);
  const index = createSearchIndexFromDocuments(documents);
  const outputPath = resolve(distRoot, "search/search-index.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeSearchIndex(index), "utf8");
  return { documents, index, outputPath };
};

const entryPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entryPath === fileURLToPath(import.meta.url)) {
  const { documents, outputPath } = await buildSearchIndex();
  const appRoot = fileURLToPath(new URL("../..", import.meta.url));
  console.log(`Search index PASS: ${documents.length} documents -> ${relative(appRoot, outputPath)}`);
}
