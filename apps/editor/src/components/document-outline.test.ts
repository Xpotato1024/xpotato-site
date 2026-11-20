import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentOutline } from "./DocumentOutline.js";
import { buildDocumentOutline } from "./document-outline.js";

describe("document outline", () => {
  it("distinguishes structural groups from their own headings and preserves source destinations", () => {
    const body =
      '<Group>\n\n## はじめに\n\n本文です。\n\n<Figure asset="demo" alt="写真" />\n\n<Group>\n\n### 詳細\n\n続き。\n\n</Group>\n\n</Group>';
    const entries = buildDocumentOutline(body);
    expect(entries.map((entry) => entry.title)).toEqual([
      "グループ 1",
      "はじめに",
      "本文です。",
      "写真",
      "グループ 2",
      "詳細",
      "続き。",
    ]);
    expect(entries.filter((entry) => entry.group).map((entry) => entry.detail)).toEqual([
      "4ブロック",
      "2ブロック",
    ]);
    const heading = entries.find((entry) => entry.title === "はじめに")!;
    expect(body.slice(heading.start, heading.end)).toBe("## はじめに");
    expect(entries.filter((entry) => entry.title === "はじめに")).toHaveLength(1);
    expect(heading.depth).toBe(1);
    expect(heading.parentStart).toBe(entries[0]!.start);
    expect(entries.at(-1)?.parentStart).toBe(entries[4]!.start);
    expect(entries.at(-1)?.depth).toBe(2);
  });

  it("summarizes actual blocks without duplicating inline text, list items or table cells", () => {
    const body = [
      "本文の **強調** と [リンク](https://example.com)。",
      "- 最初\n- 次の項目",
      "> 引用の文章\n>\n> 引用の続き",
      "| 名前 | 値 |\n| --- | --- |\n| A | 1 |",
      '```python\nprint("hello")\n```',
      '```math label="標準偏差" print="source"\n\\sigma = 1\n```',
      '<Gallery label="比較写真">\n\n<Figure asset="left" alt="左側の写真" />\n\n<Figure asset="right" alt="右側の写真" />\n\n</Gallery>',
      "![全体写真](media:overview)",
    ].join("\n\n");
    const entries = buildDocumentOutline(body);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "paragraph",
      "list",
      "quote",
      "table",
      "code",
      "math",
      "Gallery",
      "Figure",
      "Figure",
      "Figure",
    ]);
    expect(entries[0]?.title).toBe("本文の 強調 と リンク。");
    expect(entries[1]?.title).toBe("最初 / 次の項目");
    expect(entries[2]?.title).toBe("引用の文章 / 引用の続き");
    expect(entries[3]?.title).toBe("名前 / 値");
    expect(entries[4]?.detail).toBe("コード · python");
    expect(entries[5]?.title).toBe("標準偏差");
    expect(entries[7]?.parentStart).toBe(entries[6]?.start);
    expect(entries[8]?.parentStart).toBe(entries[6]?.start);
    expect(entries[9]?.parentStart).toBeNull();
    expect(body.slice(entries[8]!.start, entries[8]!.end)).toBe(
      '<Figure asset="right" alt="右側の写真" />',
    );
  });

  it("renders icons and semantic child lists while keeping summaries bounded and escaped", () => {
    const body =
      "<Group>\n\n## 見出し\n\n" +
      "長い本文".repeat(80) +
      '\n\n<Figure asset="photo" alt="&lt;写真&gt;" />\n\n</Group>';
    const entries = buildDocumentOutline(body);
    const paragraph = entries.find((entry) => entry.kind === "paragraph")!;
    expect(Array.from(paragraph.title)).toHaveLength(91);
    expect(paragraph.title.endsWith("…")).toBe(true);
    const html = renderToStaticMarkup(createElement(DocumentOutline, { body, onLocate() {} }));
    expect(html.match(/class="outline-row"/gu)).toHaveLength(4);
    expect(html.match(/<svg /gu)).toHaveLength(4);
    expect(html).toContain('<ol class="outline-children" data-depth="1">');
    expect(html).toContain('data-depth="1" data-kind="Figure"');
    expect(html).toContain("&lt;写真&gt;");
    expect(html).not.toContain("<写真>");
  });

  it("uses a leaf module's type when its description is still empty", () => {
    const entries = buildDocumentOutline(
      [
        '<Figure asset="photo" />',
        '<LinkCard href="/notes/example/" />',
        '<Demo module="example-tool" />',
      ].join("\n\n"),
    );
    expect(entries.map(({ title, detail }) => ({ title, detail }))).toEqual([
      { title: "画像・図", detail: "" },
      { title: "リンクカード", detail: "" },
      { title: "ブラウザツール", detail: "" },
    ]);
  });

  it("keeps words apart across paragraphs and nested lists within one list item", () => {
    const entries = buildDocumentOutline(
      "- First paragraph\n\n  Second paragraph\n\n  - Nested item\n\n- Last item",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.title).toBe("First paragraph / Second paragraph / Nested item / Last item");
  });

  it("leaves incomplete MDX untouched while its outline is unavailable", () => {
    expect(buildDocumentOutline("<Group>\n\n## 途中")).toEqual([]);
  });
});
