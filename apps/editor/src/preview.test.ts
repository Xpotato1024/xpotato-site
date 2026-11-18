import { describe, expect, it } from "vitest";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { previewDocument, previewFrameDocument } from "./preview.js";

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

describe("site-style safe draft preview", () => {
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
