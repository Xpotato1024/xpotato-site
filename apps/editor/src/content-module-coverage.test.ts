import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { semanticContentModulePropsSchemas } from "@xpotato/content-contracts/content";
import {
  blockTemplates,
  createBlockDocument,
  deleteRegion,
  insertRegion,
  moduleNames,
  readModuleSource,
  updateModuleChildren,
  updateModuleProps,
  updateRegion,
  writeBlockDocument,
} from "@xpotato/editor-core/blocks";
import { validatePortableMdx } from "@xpotato/portable-content";
import { contentModuleRegistry } from "../../../content/registry/content-modules.js";
import { blockChoices, allowedBlockKinds } from "./components/blocks/BlockPalette.js";
import { hasNestedEditor } from "./components/blocks/RegionContent.js";
import { ModuleBlock } from "./components/blocks/ModuleBlock.js";
import { previewDocument, type PreviewMedia } from "./preview.js";

type ModuleName = keyof typeof semanticContentModulePropsSchemas;
interface ModuleCase {
  name: ModuleName;
  renderedClass?: string;
  renderedTag?: string;
  props?: Record<string, string | boolean>;
  child?: { kind: keyof typeof blockTemplates; source: string };
}
const paragraph = { kind: "paragraph", source: "追記した **補足本文**。" } as const;
const moduleCases: ModuleCase[] = [
  { name: "Group", renderedTag: "h2", child: paragraph },
  { name: "Figure", renderedClass: "article-figure", props: { caption: "更新した写真の説明" } },
  {
    name: "Gallery",
    renderedClass: "article-gallery",
    props: { columns: "3", mobileColumns: "1" },
    child: { kind: "Figure", source: '<Figure asset="figure-3" alt="追加した写真" />' },
  },
  {
    name: "Callout",
    renderedClass: "article-callout",
    props: { kind: "warning", title: "更新した注意" },
    child: paragraph,
  },
  {
    name: "Steps",
    renderedClass: "article-steps",
    child: { kind: "Step", source: '<Step title="追加した手順">\n\n操作の続き。\n\n</Step>' },
  },
  {
    name: "Step",
    renderedClass: "article-step",
    props: { title: "更新した手順", result: "確認できた結果" },
    child: paragraph,
  },
  {
    name: "Comparison",
    renderedClass: "article-comparison",
    child: {
      kind: "ComparisonCase",
      source: '<ComparisonCase label="条件D">\n\n追加した条件。\n\n</ComparisonCase>',
    },
  },
  {
    name: "ComparisonCase",
    renderedClass: "article-comparison__case",
    props: { label: "更新した条件" },
    child: paragraph,
  },
  {
    name: "LinkCard",
    renderedClass: "article-link-card",
    props: { title: "更新したリンク", href: "https://example.com/updated" },
  },
  {
    name: "Details",
    renderedTag: "details",
    props: { summary: "更新した詳細", open: true },
    child: paragraph,
  },
  { name: "Demo", renderedClass: "preview-unavailable", props: { title: "登録済みツールの確認" } },
  {
    name: "DiagnosticList",
    renderedClass: "article-diagnostics",
    child: {
      kind: "DiagnosticItem",
      source: '<DiagnosticItem symptom="追加した症状" check="追加した確認" />',
    },
  },
  {
    name: "DiagnosticItem",
    renderedClass: "article-diagnostic",
    props: { action: "更新した対処", reason: "補足した理由" },
    child: paragraph,
  },
  {
    name: "ArticleEndnote",
    renderedClass: "article-endnote",
    props: { title: "検証の補足" },
    child: paragraph,
  },
  {
    name: "BarChart",
    renderedClass: "article-bar-chart",
    props: { title: "更新した比較", rows: '[{"label":"追加した測定","value":7.25}]' },
  },
  { name: "LineChart", renderedClass: "article-line-chart", props: { title: "更新した推移" } },
];
const restricted = new Map<ModuleName, string>([
  ["Step", "Steps"],
  ["DiagnosticItem", "DiagnosticList"],
  ["ComparisonCase", "Comparison"],
]);
function inParent(name: ModuleName, source: string): string {
  const parent = restricted.get(name);
  const sibling =
    name === "ComparisonCase"
      ? '\n\n<ComparisonCase label="もう一つの条件">\n\n比較する本文。\n\n</ComparisonCase>'
      : "";
  return parent ? `<${parent}>\n\n${source}${sibling}\n\n</${parent}>` : source;
}
const draft = (body: string) =>
  [
    "---",
    'id: "11111111-1111-4111-8111-111111111111"',
    'title: "ブロックの確認"',
    'description: "操作確認用の合成原稿"',
    'category: "software"',
    "tags: []",
    "draft: true",
    "---",
    body,
  ].join("\n");
const media: PreviewMedia[] = [1, 2, 3].map((index) => ({
  assetId: `figure-${index}`,
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yXioAAAAASUVORK5CYII=",
  width: 1,
  height: 1,
}));
function elements(html: string, within?: string) {
  const result: { tag: string; props: Record<string, unknown> }[] = [];
  const tree = fromHtml(html, { fragment: true });
  if (within) {
    visit(tree, "element", (node) => {
      if (Array.isArray(node.properties.className) && node.properties.className.includes(within)) {
        visit(node, "element", (child) => {
          result.push({ tag: child.tagName, props: child.properties });
        });
      }
    });
  } else {
    visit(tree, "element", (node) => {
      result.push({ tag: node.tagName, props: node.properties });
    });
  }
  return result;
}
function classElements(html: string, name: string, within?: string) {
  return elements(html, within).filter(
    (node) => Array.isArray(node.props.className) && node.props.className.includes(name),
  );
}

describe("site modules through CMS insertion, editing and preview", () => {
  it("covers every registered module and its actual parent-dependent insertion route", () => {
    const names = Object.keys(semanticContentModulePropsSchemas).sort();
    expect(moduleCases.map((item) => item.name).sort()).toEqual(names);
    expect([...moduleNames].sort()).toEqual(names);
    expect(contentModuleRegistry.map((item) => item.id).sort()).toEqual(names);
    expect(
      blockChoices
        .filter((item) => names.includes(item.kind))
        .map((item) => item.kind)
        .sort(),
    ).toEqual(names);
    for (const item of moduleCases) {
      const parent = restricted.get(item.name);
      expect(allowedBlockKinds(parent), item.name).toContain(item.name);
      if (parent) {
        expect(allowedBlockKinds(), item.name).not.toContain(item.name);
      }
      expect(hasNestedEditor(item.name), item.name).toBe(Boolean(item.child));
      expect(
        contentModuleRegistry.find((entry) => entry.id === item.name)?.allowsChildren,
        item.name,
      ).toBe(Boolean(item.child));
    }
  });

  it.each(moduleCases)(
    "$name retains surrounding source, applies fields and reloads its rendering",
    async (item) => {
      const source = blockTemplates[item.name];
      const beforeModule = readModuleSource(source)!;
      expect(beforeModule?.name).toBe(item.name);
      const context = inParent(item.name, source);
      expect(validatePortableMdx(context)).toEqual([]);
      const original = createBlockDocument(
        "前の文章 **保持**。\n\n\n後の文章 [参照](https://example.com)。\n",
      );
      const inserted = insertRegion(original, context, 0);
      expect(writeBlockDocument(deleteRegion(inserted, 1))).toBe(writeBlockDocument(original));
      const changed = item.props
        ? updateModuleProps(source, { ...beforeModule.props, ...item.props })
        : updateModuleChildren(
            source,
            `${beforeModule.children ?? ""}\n\n${item.child!.source}\n\n`,
          );
      if (item.props) {
        expect(readModuleSource(changed)?.props).toMatchObject(item.props);
        expect(readModuleSource(changed)?.children).toBe(beforeModule.children);
      } else {
        expect(readModuleSource(changed)?.children).toContain(beforeModule.children ?? "");
      }
      const updated = updateRegion(inserted, inserted.regions[1]!.id, inParent(item.name, changed));
      const saved = writeBlockDocument(updated);
      expect(updated.regions[0]).toBe(original.regions[0]);
      expect(updated.regions[2]).toBe(original.regions[1]);
      expect(writeBlockDocument(createBlockDocument(saved))).toBe(saved);
      expect(validatePortableMdx(saved)).toEqual([]);
      const preview = await previewDocument(draft(saved), { media });
      if (item.renderedClass) {
        expect(classElements(preview.html, item.renderedClass).length).toBeGreaterThan(0);
      }
      if (item.renderedTag) {
        expect(elements(preview.html).some((node) => node.tag === item.renderedTag)).toBe(true);
      }
      if (item.name === "Demo") {
        expect(preview.warnings).toHaveLength(1);
        expect(preview.warnings[0]).toContain("正規レイアウト");
      } else {
        expect(preview.warnings).toEqual([]);
        expect(classElements(preview.html, "preview-unavailable")).toHaveLength(0);
      }
      expect(
        elements(preview.html).some((node) =>
          ["script", "iframe", "astro-island"].includes(node.tag),
        ),
      ).toBe(false);
    },
  );

  it.each(moduleCases.filter((item) => item.child))(
    "$name exposes children to the editor and preserves them when adding another",
    (item) => {
      const source = blockTemplates[item.name];
      const module = readModuleSource(source)!;
      expect(allowedBlockKinds(item.name)).toContain(item.child!.kind);
      const calls: { body: string; parent: string }[] = [];
      renderToStaticMarkup(
        createElement(ModuleBlock, {
          source,
          onChange: () => {},
          renderChildren: (body: string, _offset: number, parent: string) => {
            calls.push({ body, parent });
            return createElement("div", null, body);
          },
        }),
      );
      expect(calls).toEqual([{ body: module.children ?? "", parent: item.name }]);
      const next = updateModuleChildren(
        source,
        `${module.children ?? ""}\n\n${item.child!.source}\n\n`,
      );
      expect(readModuleSource(next)?.props).toEqual(module.props);
      expect(readModuleSource(next)?.children).toContain(item.child!.source);
      expect(readModuleSource(next)?.children).toContain(module.children ?? "");
      expect(validatePortableMdx(inParent(item.name, next))).toEqual([]);
    },
  );
});

describe("ordinary Markdown blocks", () => {
  const cases = [
    ["paragraph", "本文 **強調** と [リンク](https://example.com)。", "p"],
    ["heading", "### 更新した見出し", "h3"],
    ["list", "- 一つ目\n- 二つ目\n  - 入れ子", "ul"],
    ["orderedList", "3. 三番目\n4. 四番目", "ol"],
    ["quote", "> 引用文。\n>\n> **出典**。", "blockquote"],
    ["divider", "***", "hr"],
    ["table", "| 項目 | 数値 |\n| :--- | ---: |\n| 更新 | 1.25 |", "table"],
    ["code", '```python title="sample.py"\nprint("<script>")\n```', "code"],
    ["math", '```math label="標準偏差"\n\\sigma = 2\n```', "math"],
  ] as const;
  it.each(cases)(
    "%s is inserted, edited, round-tripped and rendered as its intended element",
    async (kind, replacement, tag) => {
      expect(allowedBlockKinds()).toContain(kind);
      const original = createBlockDocument("既存の文章。");
      const added = insertRegion(original, blockTemplates[kind], 0);
      const updated = updateRegion(added, added.regions[1]!.id, replacement);
      const source = writeBlockDocument(updated);
      expect(updated.regions[0]).toBe(original.regions[0]);
      expect(writeBlockDocument(createBlockDocument(source))).toBe(source);
      expect(validatePortableMdx(source)).toEqual([]);
      const preview = await previewDocument(draft(source));
      expect(preview.warnings).toEqual([]);
      expect(elements(preview.html).some((node) => node.tag === tag)).toBe(true);
      if (kind === "orderedList") {
        expect(elements(preview.html).find((node) => node.tag === "ol")?.props.start).toBe(3);
      }
      if (kind === "code") {
        expect(preview.html).toContain("python");
        expect(preview.html).toContain("&lt;script&gt;");
      }
    },
  );
});

describe("comparison and graph regression cases", () => {
  it("retains four independent condition bodies after reloading the comparison", async () => {
    const before = blockTemplates.Comparison;
    const fourth =
      '<ComparisonCase label="条件D">\n\n四つ目の本文。\n\n<Figure asset="figure-3" alt="条件Dの写真" />\n\n</ComparisonCase>';
    const source = updateModuleChildren(
      before,
      `${readModuleSource(before)!.children}\n\n${fourth}\n\n`,
    );
    expect(validatePortableMdx(source)).toEqual([]);
    const doc = await previewDocument(draft(writeBlockDocument(createBlockDocument(source))), {
      media,
    });
    expect(classElements(doc.html, "article-comparison__case")).toHaveLength(4);
    for (const label of ["条件A", "条件B", "条件C", "条件D", "四つ目の本文。", "条件Dの写真"]) {
      expect(doc.html).toContain(label);
    }
    expect(doc.warnings).toEqual([]);
  });
  it("keeps legacy comparison source available while rejecting orphan new cases", async () => {
    const source =
      '<Comparison leftLabel="前" rightLabel="後">\n\n既存の比較本文。\n\n</Comparison>';
    expect(validatePortableMdx(source)).toEqual([]);
    expect(writeBlockDocument(createBlockDocument(source))).toBe(source);
    const doc = await previewDocument(draft(source));
    expect(doc.html).toContain("既存の比較本文。");
    expect(doc.html).toContain("article-comparison__legacy-labels");
    expect(validatePortableMdx(blockTemplates.ComparisonCase).length).toBeGreaterThan(0);
  });
  it("accepts unsorted repeated X in scatter data but rejects it as a connecting line", async () => {
    const series = JSON.stringify([
      {
        label: "観測",
        points: [
          { x: 2, y: 1 },
          { x: 1, y: 3 },
          { x: 2, y: -1 },
        ],
      },
    ]);
    const base = readModuleSource(blockTemplates.LineChart)!.props;
    const scatter = updateModuleProps(blockTemplates.LineChart, {
      ...base,
      kind: "scatter",
      series,
    });
    expect(validatePortableMdx(scatter)).toEqual([]);
    const doc = await previewDocument(draft(scatter));
    expect(
      classElements(doc.html, "article-line-chart__point", "article-line-chart__plot"),
    ).toHaveLength(3);
    expect(classElements(doc.html, "article-line-chart__line")).toHaveLength(0);
    expect(doc.warnings).toEqual([]);
    expect(() => updateModuleProps(scatter, { ...base, kind: "line", series })).toThrow();
  });
  it.each([
    { kind: "unsafe" },
    { series: "{}" },
    { series: '[{"label":"観測","points":[{"x":0,"y":1},{"x":1,"y":1e13}]}]' },
    { series: '[{"label":"観測","points":[{"x":0,"y":1},{"x":1,"y":"2"}]}]' },
  ])("rejects invalid graph fields without replacing the existing source: %j", (patch) => {
    const source = blockTemplates.LineChart;
    expect(() =>
      updateModuleProps(source, { ...readModuleSource(source)!.props, ...patch }),
    ).toThrow();
    expect(writeBlockDocument(createBlockDocument(source))).toBe(source);
  });
});
