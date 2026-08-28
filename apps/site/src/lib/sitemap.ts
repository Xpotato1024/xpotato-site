import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export interface SitemapEligibilityInput {
  readonly route: string;
  readonly draft: boolean;
  readonly noindex: boolean;
  readonly searchPath: string;
}

export const isSitemapEligible = (input: SitemapEligibilityInput): boolean =>
  !input.draft && !input.noindex && input.route !== input.searchPath;

const walk = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
};

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---/u;
const collections = ["blog", "notes", "projects", "tools", "pages"] as const;

export const collectSitemapExcludedUrls = async (input: Readonly<{
  contentRoot: URL;
  canonicalOrigin: string;
  searchPath: string;
}>): Promise<ReadonlySet<string>> => {
  const contentRoot = fileURLToPath(input.contentRoot);
  const excluded = new Set<string>([new URL(input.searchPath, input.canonicalOrigin).href]);
  for (const collection of collections) {
    const directory = join(contentRoot, collection);
    for (const file of await walk(directory)) {
      if (!/\.mdx?$/iu.test(file)) continue;
      const source = await readFile(file, "utf8");
      const match = frontmatterPattern.exec(source);
      if (!match?.[1]) throw new Error(`Frontmatter missing while deriving sitemap: ${file}`);
      const data = parseYaml(match[1]) as { draft?: unknown; seo?: { noindex?: unknown } };
      const relativePath = relative(directory, file).replaceAll("\\", "/");
      const slug = relativePath.slice(0, -extname(relativePath).length);
      const route = collection === "pages" ? (slug === "index" ? "/" : `/${slug}/`) : `/${collection}/${slug}/`;
      if (!isSitemapEligible({
        route,
        draft: data.draft === true,
        noindex: data.seo?.noindex === true,
        searchPath: input.searchPath,
      })) {
        excluded.add(new URL(route, input.canonicalOrigin).href);
      }
    }
  }
  return excluded;
};
