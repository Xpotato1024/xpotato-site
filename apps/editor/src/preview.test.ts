import { describe, expect, it } from "vitest";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { previewDocument, previewFrameDocument, type EditorSeriesPreview } from "./preview.js";
import { footnoteBackrefIconPath } from "../../site/src/shared/blocks/transforms/footnote-backlinks.mjs";

const draft = (body: string, title = "プレビューの確認") =>
  [
    "---",
    'id: "11111111-1111-4111-8111-111111111111"',
    "title: " + JSON.stringify(title),
    'description: "本文の説明"',
    'category: "software"',
    "tags: []",
    "draft: true",
    "---",
    body,
  ].join("\n");
const elements = (html: string) => {
  const result: { tag: string; props: Record<string, unknown> }[] = [];
  visit(fromHtml(html, { fragment: true }), "element", (node) => {
    result.push({ tag: node.tagName, props: node.properties });
  });
  return result;
};
const currentId = "11111111-1111-4111-8111-111111111111";
const previousId = "22222222-2222-4222-8222-222222222222";
const nextId = "33333333-3333-4333-8333-333333333333";
const editorSeries = (): EditorSeriesPreview => ({
  registry: {
    schemaVersion: 1,
    series: [
      {
        id: "materials",
        slug: "materials",
        title: "材料の学習コース",
        description: "読む順序を決める",
        kind: "course",
        status: "ongoing",
        entries: [previousId, currentId, nextId].map((contentId) => ({ contentId })),
      },
    ],
  },
  documents: [
    {
      contentId: previousId,
      title: "前のメモ",
      collection: "notes",
      path: "content/notes/previous.mdx",
    },
    {
      contentId: nextId,
      title: "次の資料",
      collection: "pages",
      path: "content/pages/reference.mdx",
    },
  ],
});

describe("site-style safe draft preview", () => {
  it("uses the site SVG for every footnote return link and keeps repeated references distinct", async () => {
    const result = await previewDocument(
      draft(
        "本文[^source]。もう一度[^source]。別の資料[^other]。\n\n[^source]: [設計資料](https://example.com/)\n\n[^other]: 補足。",
      ),
    );
    const nodes = elements(result.html);
    const references = nodes.filter((node) => Object.hasOwn(node.props, "dataFootnoteRef"));
    const backlinks = nodes.filter((node) => Object.hasOwn(node.props, "dataFootnoteBackref"));
    const ids = references.map((node) => node.props.id);
    expect(references).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(backlinks).toHaveLength(3);
    expect(backlinks.map((node) => String(node.props.href).slice(1))).toEqual(ids);
    expect(backlinks.map((node) => node.props.ariaLabel)).toEqual([
      "本文の脚注1の参照1へ戻る",
      "本文の脚注1の参照2へ戻る",
      "本文の脚注2の参照1へ戻る",
    ]);
    expect(
      nodes.filter((node) => node.tag === "path" && node.props.d === footnoteBackrefIconPath),
    ).toHaveLength(3);
    expect(result.html).toContain('class="footnote-backref-icon"');
    expect(result.html).toContain('data-preview-href="https://example.com/"');
    expect(result.html).not.toMatch(/[↩\uFE0E\uFE0F]|<script|<img/u);
    expect(result.warnings).toEqual([]);
  });

  it("keeps return targets when a footnote refers to another note", async () => {
    const result = await previewDocument(
      draft("本文[^first]。\n\n[^first]: 補足[^second]。\n\n[^second]: 別の補足。"),
    );
    const nodes = elements(result.html);
    const ids = new Set(nodes.map((node) => node.props.id));
    const targets = nodes
      .filter(
        (node) =>
          Object.hasOwn(node.props, "dataFootnoteRef") ||
          Object.hasOwn(node.props, "dataFootnoteBackref"),
      )
      .map((node) => String(node.props.href).slice(1));
    expect(targets).toHaveLength(4);
    for (const target of targets) expect(ids.has(target)).toBe(true);
  });

  it("renders nested groups transparently with the same headings, lead and child order", async () => {
    const body =
      "導入。\n\n## 重複する見出し\n\n本文。\n\n### 小見出し\n\n**強調**と[リンク](https://example.com)。\n\n## 重複する見出し\n\n後。";
    const plain = await previewDocument(draft(body));
    const grouped = await previewDocument(
      draft(
        "<Group>\n\n導入。\n\n<Group>\n\n## 重複する見出し\n\n本文。\n\n### 小見出し\n\n**強調**と[リンク](https://example.com)。\n\n</Group>\n\n## 重複する見出し\n\n後。\n\n</Group>",
      ),
    );
    expect(grouped.html).toBe(plain.html);
    expect(grouped.warnings).toEqual([]);
  });

  it("previews the local series order with drafts, adjacent entries, and a disabled index link", async () => {
    const input = editorSeries();
    const result = await previewDocument(draft("本文"), { editorSeries: input });
    expect(result.html).toContain('class="series-navigation"');
    expect(result.html).toContain("第2回 / 登録3回");
    expect(result.html).toContain("下書きを含む登録順です。");
    expect(result.html).toContain("前のメモ");
    expect(result.html).toContain("次の資料");
    expect(result.html).toContain('data-preview-href="/notes/previous/"');
    expect(result.html).toContain('data-preview-href="/reference/"');
    expect(result.html).toContain('data-preview-href="/series/materials/"');
    expect(result.html).toContain("全3回の目次を見る");
    expect(result.html).not.toContain("公開3回");
    expect(elements(result.html).some((node) => node.props.href)).toBe(false);
    expect(result.warnings).toEqual([]);

    input.registry.series[0]!.entries.reverse();
    const moved = await previewDocument(draft("本文"), { editorSeries: input });
    expect(moved.html).toMatch(/← 前の回 · 第1回<\/span><span>次の資料/u);
    expect(moved.html).toMatch(/次の回 · 第3回 →<\/span><span>前のメモ/u);
  });

  it("keeps unindexed draft membership and missing entry positions without inventing links", async () => {
    const input = editorSeries();
    input.documents = [];
    input.registry.series.push({
      ...input.registry.series[0]!,
      id: "second",
      slug: "second",
      title: "別の連載 <script>",
      entries: [{ contentId: currentId }],
    });
    const result = await previewDocument(draft("本文"), { editorSeries: input });
    expect(result.html).toContain("第2回 / 登録3回");
    expect(result.html).toContain("第1回 / 登録1回");
    expect(result.html).toContain("未取得の記事");
    expect(result.html).not.toContain("/notes/previous/");
    expect(result.html).toContain("別の連載 &lt;script&gt;");
    expect(
      elements(result.html).filter(
        (node) =>
          Array.isArray(node.props.className) && node.props.className.includes("series-navigation"),
      ),
    ).toHaveLength(2);
    expect(elements(result.html).some((node) => node.tag === "script")).toBe(false);
    input.registry.series.forEach((series) => {
      series.entries = series.entries.filter((entry) => entry.contentId !== currentId);
    });
    const removed = await previewDocument(draft("本文"), { editorSeries: input });
    expect(removed.html).not.toContain('class="series-navigation"');
  });

  it.each(["ongoing", "completed", "paused"] as const)(
    "uses the %s ending in the draft series preview",
    async (status) => {
      const input = editorSeries();
      input.registry.series[0]!.entries = [{ contentId: currentId }];
      input.registry.series[0]!.status = status;
      const result = await previewDocument(draft("本文"), { editorSeries: input });
      expect(result.html).toContain(
        status === "completed" ? "この連載の最終回です。" : "現在の最新回です。",
      );
      expect(result.html).not.toContain(status === "completed" ? "最新回" : "最終回");
    },
  );

  it("renders authoring structures and language labels without executing MDX", async () => {
    const result = await previewDocument(
      draft(
        [
          "導入の段落です。",
          "",
          "## 見出し",
          "",
          "> 引用",
          "",
          "- **太字**",
          "- *斜体*",
          "",
          "[リンク](https://example.test/)",
          "",
          "|項目|値|",
          "|---|---:|",
          "|A|10|",
          "",
          '```typescript\nconst text = "<script>";\n```',
        ].join("\n"),
      ),
    );
    expect(result.html).toContain('class="prose article-lead"');
    expect(result.html).toContain("<blockquote>");
    expect(result.html).toContain("<strong>太字</strong>");
    expect(result.html).toContain('data-align="right"');
    expect(result.html).toContain('class="code-language">typescript');
    expect(result.html).toContain('class="language-typescript"');
    expect(result.html).toContain('data-preview-href="https://example.test/"');
    expect(elements(result.html).some((node) => node.tag === "script")).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("uses real supplied media and semantic classes, including responsive galleries", async () => {
    const body =
      '<Gallery columns="3" tabletColumns="2" mobileColumns="1" gap="small">\n\n<Figure asset="sample" alt="試作品" caption="寸法を確認" />\n\n</Gallery>\n\n<Callout kind="tip" title="確認すること">\n\n補足です。\n\n</Callout>\n\n<Steps>\n\n<Step title="最初" result="完了">\n\n手順の本文\n\n</Step>\n\n</Steps>';
    const result = await previewDocument(draft(body), {
      media: [
        { assetId: "sample", src: "blob:https://xpotato.net/image", width: 640, height: 480 },
      ],
    });
    expect(result.html).toContain('class="article-gallery"');
    expect(result.html).toContain('data-columns="3"');
    expect(result.html).toContain('data-mobile-columns="1"');
    expect(result.html).toContain('src="blob:https://xpotato.net/image"');
    expect(result.html).toContain('alt="試作品"');
    expect(result.html).toContain('class="article-figure__caption">寸法を確認');
    expect(result.html).toContain('class="article-callout"');
    expect(result.html).toContain('class="article-steps"');
    expect(result.html).toContain('class="article-step-result"');
    expect(result.warnings).toEqual([]);
  });

  it("converts a TeX sigma into the production MathML form and reports invalid formulas", async () => {
    const valid = await previewDocument(
      draft('```math label="標準偏差"\n\\sigma = \\sqrt{2}\n```'),
    );
    expect(valid.html).toContain("<math");
    expect(valid.html).toContain("σ");
    expect(valid.html).toContain('class="math-block"');
    expect(valid.warnings).toEqual([]);
    const invalid = await previewDocument(draft('```math label="確認"\n\\notacommand\n```'));
    expect(invalid.warnings.some((warning) => warning.startsWith("数式:"))).toBe(true);
    expect(invalid.html).toContain("数式を確認してください");
    const unsafe = await previewDocument(
      draft('```math label="確認"\n\\href{https://private.test/}{x}\n```'),
    );
    expect(elements(unsafe.html).some((node) => node.props.href)).toBe(false);
  });

  it("does not execute expressions, raw HTML, or unrecognized modules", async () => {
    const result = await previewDocument(
      draft(
        [
          '{globalThis.alert("unsafe")}',
          "",
          '<script>alert("unsafe")</script>',
          "",
          "<UnknownWidget />",
          "",
          "<constructor />",
          "",
          '<Demo module="example" title="動作例" />',
          "",
          '<Figure asset="sample" alt="画像" onClick="unsafe" />',
          "",
          "[危険](javascript:alert%281%29)",
          "",
          "![外部](https://private.test/tracker.png)",
        ].join("\n"),
        '<script>alert("title")</script>',
      ),
    );
    const nodes = elements(result.html);
    expect(nodes.some((node) => ["script", "iframe", "object", "embed"].includes(node.tag))).toBe(
      false,
    );
    expect(nodes.some((node) => Object.keys(node.props).some((key) => /^on/iu.test(key)))).toBe(
      false,
    );
    expect(nodes.some((node) => node.props.href || node.props.src)).toBe(false);
    expect(result.warnings.some((warning) => warning.includes("動作例"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("本文は保持"))).toBe(true);
  });

  it("keeps chart sizing in generated CSS and isolates the display document", async () => {
    const rows = JSON.stringify([{ label: "A", value: 50 }]).replaceAll('"', "&quot;");
    const result = await previewDocument(
      draft(`<BarChart title="結果" unit="件" max="100" rows="${rows}" />`),
    );
    expect(result.html).toContain('class="article-bar-chart"');
    expect(result.css).toContain("width:50%");
    expect(elements(result.html).some((node) => node.props.style)).toBe(false);
    const html = previewFrameDocument(result, "blob:https://xpotato.net/style");
    expect(html).toContain("script-src 'none'");
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).not.toContain("<script");
    expect(() => previewFrameDocument(result, "https://external.test/style.css")).toThrow();
  });
});
