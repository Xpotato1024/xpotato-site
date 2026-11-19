import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import {
  comparisonModulePropsSchema,
  comparisonCaseModulePropsSchema,
} from "@xpotato/content-contracts/content";

type Renderer = (children: string, props?: Record<string, unknown>) => Promise<string>;
let renderComparison: Renderer;
let renderCase: Renderer;
beforeAll(async () => {
  const load = async (filename: string): Promise<Renderer> => {
    const source = await readFile(new URL(filename, import.meta.url), "utf8");
    const compiled = transform(source, { filename, resultScopedSlot: true });
    const code = ts.transpileModule(compiled.code, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
    new Function("require", "exports", code)((id: string) => {
      if (id === "astro/runtime/server/index.js") return { ...runtime, createMetadata: () => ({}) };
      if (id === "@xpotato/content-contracts/content") {
        return { comparisonModulePropsSchema, comparisonCaseModulePropsSchema };
      }
      throw new Error(`Unexpected dependency: ${id}`);
    }, module.exports);
    const container = await experimental_AstroContainer.create();
    return (children, props = {}) =>
      container.renderToString(module.exports.default, { props, slots: { default: children } });
  };
  [renderComparison, renderCase] = await Promise.all([
    load("./Comparison.astro"),
    load("./ComparisonCase.astro"),
  ]);
});

describe("static multiple-condition comparison", () => {
  it("renders each condition as a labeled column with its own full content and no runtime", async () => {
    const bodies = [
      "<p>文章と<strong>強調</strong>。</p>",
      '<figure><img src="/fixture.svg" alt="条件の図"><figcaption>説明。</figcaption></figure>',
      "<ul><li>条件の確認</li><li>注意点</li></ul>",
    ];
    const cases = await Promise.all(
      bodies.map((body, index) => renderCase(body, { label: `条件${index + 1}` })),
    );
    const html = await renderComparison(cases.join(""));
    expect(html.match(/class="article-comparison__case"/gu)).toHaveLength(3);
    expect(html).toContain('class="article-comparison__cases"');
    for (const [index, body] of bodies.entries()) {
      expect(html).toContain(`aria-label="条件${index + 1}"`);
      expect(html).toContain(body);
    }
    expect(html).not.toMatch(/<script|astro-island|article-comparison__legacy/u);
  });

  it("keeps the old two-label body in authored order without inventing condition membership", async () => {
    const body = "<p>以前の説明。</p><figure>比較画像</figure><p>現在の説明。</p>";
    const html = await renderComparison(body, { leftLabel: "以前", rightLabel: "現在" });
    expect(html).toContain('class="article-comparison__legacy-labels"');
    expect(html).toContain('class="article-comparison__legacy-body"');
    expect(html).toContain(body);
    expect(html).toContain('data-left-label="以前"');
    expect(html).toContain('data-right-label="現在"');
    expect(html).not.toContain('class="article-comparison__cases"');
  });

  it("escapes labels and rejects unknown, missing or half-specified properties", async () => {
    const html = await renderCase("<p>本文</p>", { label: '\"><img onerror=alert(1)>' });
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    const imageElements: string[] = [];
    visit(fromHtml(html, { fragment: true }), "element", (node) => {
      if (node.tagName === "img") imageElements.push(node.tagName);
    });
    expect(imageElements).toEqual([]);
    await expect(renderCase("<p>本文</p>")).rejects.toThrow();
    await expect(renderCase("<p>本文</p>", { label: "条件", class: "custom" })).rejects.toThrow();
    await expect(renderComparison("<p>本文</p>", { leftLabel: "片側だけ" })).rejects.toThrow();
  });
});
