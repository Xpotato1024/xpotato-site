import {expandedCss} from "../../styles/expanded-css-test-helper.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "@astrojs/compiler-rs";
import { createServer, type ViteDevServer } from "vite";
import ts from "typescript";
import { parse } from "parse5";
import { contentModuleRegistry } from "../../content-registry/content-modules.js";

describe("ArticleEndnote static rendering", () => {
  let server: ViteDevServer;
  let cache: string;
  let render: (props?: Record<string, unknown>) => Promise<string>;

  beforeAll(async () => {
    cache = await mkdtemp(join(tmpdir(), "article-endnote-"));
    server = await createServer({
      configFile: false, root: fileURLToPath(new URL("../../../", import.meta.url)),
      cacheDir: cache, server: { middlewareMode: true, watch: null }, appType: "custom",
      plugins: [{ name: "test-astro-ssr", async transform(source, id) {
        if (!id.endsWith(".astro")) return;
        const compiled = transform(source, { filename: id, internalURL: "astro/compiler-runtime", resultScopedSlot: true, resolvePath: specifier => specifier });
        return ts.transpileModule(compiled.code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
      } }],
    });
    const { experimental_AstroContainer } = await server.ssrLoadModule("astro/container");
    const { default: component } = await server.ssrLoadModule(fileURLToPath(new URL("ArticleEndnote.astro", import.meta.url)));
    const container = await experimental_AstroContainer.create();
    render = props => container.renderToString(component, { props, slots: { default: "<p>図は模式図です。</p><p>実機では未測定です。</p>" } });
  });

  afterAll(async () => {
    await server?.close();
    if (cache) await rm(cache, { recursive: true, force: true });
  });

  it("gives the aside a visible default label without headings, actions or hydration", async () => {
    expect(contentModuleRegistry.find(record => record.id === "ArticleEndnote")).toEqual({
      id: "ArticleEndnote", status: "active", allowsChildren: true,
      allowedCollections: ["blog", "notes", "projects", "tools", "pages"],
    });
    const html = await render();
    expect(html).toContain('class="article-endnote" aria-label="記事について"');
    expect(html).toContain('<p class="article-endnote-title">記事について</p>');
    expect(html).toContain("<p>図は模式図です。</p><p>実機では未測定です。</p>");
    expect(html).not.toMatch(/<(?:h[1-6]|button|script|astro-island)\b|role="alert"/u);
  });

  it("trims the custom title and escapes both attribute and visible text", async () => {
    const title = '<img src=x onerror="alert(1)"> & 検証';
    const html = await render({ title: `  ${title}  ` });
    const document = parse(html);
    const walk = (node: any): any[] => [node, ...(node.childNodes ?? []).flatMap(walk)];
    const nodes = walk(document);
    expect(nodes.find(node => node.tagName === "aside")?.attrs).toContainEqual({ name: "aria-label", value: title });
    expect(nodes.find(node => node.tagName === "p")?.childNodes.map((node: any) => node.value).join("")).toBe(title);
    expect(nodes.some(node => node.tagName === "img" || node.attrs?.some((attr: any) => attr.name === "onerror"))).toBe(false);
  });

  it("rejects empty labels and extra props instead of forwarding DOM attributes", async () => {
    await expect(render({ title: " " })).rejects.toThrow();
    await expect(render({ title: "検証", class: "custom" })).rejects.toThrow();
  });

  it("uses existing muted and divider tokens with scoped CSS and conditional loading", async () => {
    const css = expandedCss(await readFile(new URL("../../styles/article-modules.css", import.meta.url), "utf8"));
    const rules = css.split("\n").filter(line => line.includes(".article-endnote"));
    expect(rules).toHaveLength(4);
    expect(rules.every(rule => rule.startsWith(".prose ") && rule.includes(":not(:where([data-bt], [data-bt] *))"))).toBe(true);
    expect(rules.join("\n")).toContain("var(--text-muted)");
    expect(rules.join("\n")).toContain("var(--border-divider)");
    expect(rules.join("\n")).not.toMatch(/--[\w-]+\s*:|var\(--accent\)|#[\da-f]+\b/u);
    const layout = await readFile(new URL("../../layouts/ContentLayout.astro", import.meta.url), "utf8");
    expect(layout).toContain("compact-figure|endnote");
    expect(layout).toContain("articleModulesCssHref={hasArticleModules ? articleModulesCssHref : undefined}");
    expect(layout.indexOf('set:html={articleParts.body}')).toBeLessThan(layout.indexOf("<PageShare"));
  });
});
