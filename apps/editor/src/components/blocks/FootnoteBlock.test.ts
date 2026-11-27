import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FootnoteBlock } from "./FootnoteBlock.js";
import { describeRegion } from "./RegionContent.js";
import { allowedBlockKinds, blockChoices } from "./BlockPalette.js";
import { buildDocumentOutline } from "../document-outline.js";
import { canEditFootnoteText, canEditRich, BlockPreview } from "./BlockPreview.js";

describe("footnote authoring controls", () => {
  it("opens existing definitions as footnotes and exposes a fixed reference with editable content", () => {
    const source = "[^architecture]: [設計資料](https://example.com/)を確認。";
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      createElement(FootnoteBlock, { source, onChange, onSelection: () => {} }),
    );
    expect(describeRegion(source).label).toBe("脚注");
    expect(html).toContain("本文の参照記号");
    expect(html).toContain('value="[^architecture]"');
    expect(html).toMatch(/readonly=""/iu);
    expect(html).toContain("脚注の内容");
    expect(html).toContain("[設計資料](https://example.com/)を確認。");
    expect(html).not.toContain("ブロックのMDX");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    "本文[^architecture]。",
    "## 見出し[^architecture]",
    "> 引用[^architecture]。",
    "- 項目[^architecture]\n- 次の項目",
    "**太字[^architecture]**と通常本文。",
    "|項目|資料|\n|---|---|\n|A|[^architecture]|",
  ])("keeps references in %s out of the rich serializer", (source) => {
    expect(canEditRich(source)).toBe(false);
    expect(canEditFootnoteText(source)).toBe(true);
    expect(describeRegion(source).label).not.toBe("MDX");
    const html = renderToStaticMarkup(createElement(BlockPreview, { source }));
    expect(html).toContain('aria-label="脚注 architecture"');
  });

  it("keeps ordinary rich editing and treats escaped markers or inline code as literal text", () => {
    for (const source of [
      "通常の **本文**。",
      "参照の書き方 `[^source]`。",
      "文字として\\[^source]を記載。",
    ]) {
      expect(canEditRich(source)).toBe(true);
      expect(canEditFootnoteText(source)).toBe(false);
    }
  });

  it("offers root footnote insertion and identifies the same notes in the outline", () => {
    expect(blockChoices.find((choice) => choice.kind === "footnote")?.label).toBe("脚注");
    expect(allowedBlockKinds()).toContain("footnote");
    expect(allowedBlockKinds("Gallery")).not.toContain("footnote");
    expect(allowedBlockKinds("Group")).not.toContain("footnote");
    expect(buildDocumentOutline("本文[^source]。\n\n[^source]: 参考資料。").at(-1)).toMatchObject({
      kind: "footnote",
      title: "参考資料。",
      detail: "脚注 · source",
    });
  });
});
