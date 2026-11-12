import { describe, expect, it } from "vitest";
import { articleEndnoteModulePropsSchema, contentModuleRecordSchema, semanticContentModulePropsSchemas } from "@xpotato/content-contracts";
import { validatePortableMdx } from "./index.js";

const endnote = (body: string, props = "") => `<ArticleEndnote${props}>\n\n${body}\n\n</ArticleEndnote>`;

describe("ArticleEndnote contract", () => {
  it("registers the shared semantic module schema", () => {
    expect(semanticContentModulePropsSchemas.ArticleEndnote).toBe(articleEndnoteModulePropsSchema);
    expect(contentModuleRecordSchema.shape.id.options).toContain("ArticleEndnote");
  });

  it("accepts an omitted title and trims a bounded plain text title", () => {
    expect(articleEndnoteModulePropsSchema.parse({})).toEqual({});
    expect(articleEndnoteModulePropsSchema.parse({ title: "  図と検証について  " })).toEqual({ title: "図と検証について" });
    expect(articleEndnoteModulePropsSchema.safeParse({ title: "あ".repeat(100) }).success).toBe(true);
    for (const title of ["", " \t\n ", "あ".repeat(101), "図\n検証", "図\u0000検証", "図\u0085検証", "図\u2028検証", "図\u2029検証"]) {
      expect(articleEndnoteModulePropsSchema.safeParse({ title }).success, JSON.stringify(title)).toBe(false);
    }
    // MDX normalizes raw NUL to a replacement character before schema validation.
    for (const title of ["", " \t\n ", "あ".repeat(101), "図\n検証", "図\u0085検証", "図\u2028検証", "図\u2029検証"]) {
      expect(validatePortableMdx(endnote("模式図です。", ` title="${title}"`)).length).toBeGreaterThan(0);
    }
  });

  it("keeps short paragraphs and safe inline Markdown portable", () => {
    expect(validatePortableMdx(endnote("図は**模式図**です。\n\n`条件A`で確認し、[仕様](https://example.com/spec)を参照しました。", ' title="図と検証について"'))).toEqual([]);
    expect(validatePortableMdx(endnote("実機では未測定です。"))).toEqual([]);
  });

  it.each(["", "  ", "## 見出し", "- 箇条書き", "```js\nconst x = 1;\n```", "![図](media:diagram)", '<Callout kind="note">補足</Callout>', endnote("入れ子")])("rejects non-paragraph or empty slot shape: %s", body => {
    expect(validatePortableMdx(endnote(body)).join(" ")).toMatch(/ArticleEndnote requires/u);
  });

  it("rejects inline and nested placement", () => {
    expect(validatePortableMdx('本文 <ArticleEndnote>補足</ArticleEndnote>').join(" ")).toMatch(/top-level block/u);
    expect(validatePortableMdx(`<Details summary="補足">\n\n${endnote("未測定です。")}\n\n</Details>`).join(" ")).toMatch(/top-level block/u);
  });

  it.each([' title={label}', ' {...props}', ' class="custom"', ' style="color:red"', ' aria-label="別名"', ' onClick="run"', ' title="一" title="二"'])("rejects expressions or DOM passthrough: %s", props => {
    expect(validatePortableMdx(endnote("模式図です。", props)).length).toBeGreaterThan(0);
  });

  it("preserves the existing import, HTML and expression restrictions inside the slot", () => {
    for (const body of ['<span>本文</span>', '{danger}', '本文 <img src="x" />']) {
      expect(validatePortableMdx(endnote(body)).length).toBeGreaterThan(0);
    }
    expect(validatePortableMdx('import Note from "./Note";\n\n' + endnote("本文")).join(" ")).toMatch(/import\/export/u);
    expect(articleEndnoteModulePropsSchema.safeParse({ title: "補足", id: "custom" }).success).toBe(false);
  });
});
