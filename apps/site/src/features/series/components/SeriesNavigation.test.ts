import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { transform } from "@astrojs/compiler-rs";
import ts from "typescript";
import * as runtime from "astro/runtime/server/index.js";
import { experimental_AstroContainer } from "astro/container";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import {
  seriesForContent,
  type PublicSeries,
  type SeriesNavigation,
} from "@xpotato/portable-content/series";
import * as labels from "../model/labels.js";

let render: (navigation: SeriesNavigation) => Promise<string>;
beforeAll(async () => {
  const source = await readFile(new URL("./SeriesNavigation.astro", import.meta.url), "utf8");
  const compiled = transform(source, {
    filename: "SeriesNavigation.astro",
    resultScopedSlot: true,
  });
  const code = ts.transpileModule(compiled.code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} as { default: Parameters<typeof runtime.renderToString>[1] } };
  new Function("require", "exports", code)((id: string) => {
    if (id === "astro/runtime/server/index.js") {
      return { ...runtime, createMetadata: () => ({}) };
    }
    if (id === "../model/labels.js") {
      return labels;
    }
    throw new Error(`Unexpected dependency: ${id}`);
  }, module.exports);
  const container = await experimental_AstroContainer.create();
  render = (navigation) =>
    container.renderToString(module.exports.default, { props: { navigation } });
});

const series: PublicSeries = {
  id: "basics",
  slug: "basics",
  title: "基礎を学ぶ",
  description: "学習コース",
  kind: "course",
  status: "ongoing",
  route: "/series/basics/",
  entries: [1, 2, 3].map((ordinal) => ({
    contentId: `content-${ordinal}`,
    collection: "notes",
    title: `記事${ordinal}`,
    description: `説明${ordinal}`,
    route: `/notes/part-${ordinal}/`,
    ordinal,
  })),
};

describe("static series navigation", () => {
  it("renders accessible adjacent links and a full table of contents without runtime", async () => {
    const html = await render(seriesForContent("content-2", [series])[0]!);
    expect(html).toContain('aria-label="基礎を学ぶの読み順"');
    expect(html).toContain('rel="prev" href="/notes/part-1/"');
    expect(html).toContain('rel="next" href="/notes/part-3/"');
    expect(html).toContain('href="/series/basics/"');
    expect(html).toContain("第2回 / 公開3回");
    expect(html).not.toMatch(/<script|astro-island|onClick|client:/u);
    expect(html).not.toContain("最新回");
  });

  it("labels latest publication independently from series completion", async () => {
    for (const status of ["ongoing", "completed", "paused"] as const) {
      const html = await render(seriesForContent("content-3", [{ ...series, status }])[0]!);
      expect(html).toContain("現在の最新回です。");
      expect(html).toContain(labels.seriesStatusLabel(status));
      expect(html).not.toContain('rel="next"');
      expect(html).not.toContain("最終回");
    }
  });

  it("keeps single-entry navigation useful and escapes editorial text", async () => {
    const single = { ...series, title: "<script>alert(1)</script>", entries: [series.entries[0]!] };
    const html = await render(seriesForContent("content-1", [single])[0]!);
    expect(html).toContain("この連載の最初の回です。");
    expect(html).toContain("現在の最新回です。");
    expect(html).toContain("全1回の目次を見る");
    expect(html).not.toMatch(/rel="(?:prev|next)"/u);
    const tags: string[] = [];
    visit(fromHtml(html, { fragment: true }), "element", (node) => {
      tags.push(node.tagName);
    });
    expect(tags).not.toContain("script");
    expect(html).toContain("&lt;script&gt;");
  });
});
