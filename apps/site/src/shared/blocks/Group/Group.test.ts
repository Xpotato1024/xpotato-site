import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { groupModulePropsSchema } from "@xpotato/content-contracts/content";
import { compile } from "@mdx-js/mdx";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";
import { splitArticleLead } from "../../../features/articles/model/article-lead.js";

let render: (children: string, props?: Record<string, unknown>) => Promise<string>;
beforeAll(async () => {
  const source = await readFile(new URL("./Group.astro", import.meta.url), "utf8");
  const compiled = transform(source, { filename: "Group.astro", resultScopedSlot: true });
  const code = ts.transpileModule(compiled.code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
  new Function("require", "exports", code)((id: string) => {
    if (id === "astro/runtime/server/index.js") {
      return { ...runtime, createMetadata: () => ({}) };
    }
    if (id === "@xpotato/content-contracts/content") {
      return { groupModulePropsSchema };
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, module.exports);
  const container = await experimental_AstroContainer.create();
  render = (children, props = {}) =>
    container.renderToString(module.exports.default, { props, slots: { default: children } });
});

describe("static Group rendering", () => {
  it("preserves Astro heading slugs and TOC order across nested MDX groups", async () => {
    const section = "## 同じ見出し\n\n本文\n\n### 詳細\n\n図の説明";
    const tail = "## 同じ見出し\n\n続き";
    const options = { jsxImportSource: "astro", rehypePlugins: [rehypeHeadingIds] };
    const plain = await compile(section + "\n\n" + tail, options);
    const nested = await compile(
      "<Group>\n\n<Group>\n\n" + section + "\n\n</Group>\n\n" + tail + "\n\n</Group>",
      options,
    );
    expect(nested.data.astro?.headings).toEqual(plain.data.astro?.headings);
    expect(nested.data.astro?.headings?.map((heading) => heading.depth)).toEqual([2, 3, 2]);
    expect(new Set(nested.data.astro?.headings?.map((heading) => heading.slug)).size).toBe(3);
  });

  it("adds no wrapper, styles or runtime while keeping nested child order and lead extraction", async () => {
    const child = '<h2 id="part">節</h2><p>本文。</p><h3 id="detail">詳細</h3><figure>図</figure>';
    const plain = "<p>導入。</p>" + child + '<h2 id="part-1">節</h2><p>後。</p>';
    const nested = await render(
      "<p>導入。</p>" + (await render(child)) + '<h2 id="part-1">節</h2><p>後。</p>',
    );
    expect(nested).toBe(plain);
    expect(splitArticleLead(nested)).toEqual(splitArticleLead(plain));
    expect(nested).not.toMatch(/<script|astro-island|<style|<section|<div/u);
  });

  it("rejects layout and runtime props rather than forwarding them to public HTML", async () => {
    await expect(render("<p>本文。</p>", { class: "custom" })).rejects.toThrow();
  });
});
