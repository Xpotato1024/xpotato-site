import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockPreview } from "./BlockPreview.js";

describe("review marks in the block preview", () => {
  it("keeps rich formatting and escapes inline code while marking exact source text", () => {
    const source = "条件は **弱い**。`<value>`を確認。";
    const html = renderToStaticMarkup(
      createElement(BlockPreview, {
        source,
        activeCommentId: "code-comment",
        reviewMarks: [
          {
            id: "text-comment",
            start: source.indexOf("弱い"),
            end: source.indexOf("弱い") + 2,
            state: "open",
          },
          {
            id: "code-comment",
            start: source.indexOf("<value>"),
            end: source.indexOf("<value>") + 7,
            state: "proposal",
          },
        ],
      }),
    );
    expect(html).toMatch(/<strong><mark[^>]*>弱い<\/mark><\/strong>/u);
    expect(html).toMatch(
      /<code><mark[^>]*data-review-active="true"[^>]*>&lt;value&gt;<\/mark><\/code>/u,
    );
    expect(html).not.toContain("<value>");
    expect(source).toBe("条件は **弱い**。`<value>`を確認。");
  });

  it("does not guess partial offsets through escaped source text", () => {
    const source = "A &amp; B";
    const html = renderToStaticMarkup(
      createElement(BlockPreview, {
        source,
        reviewMarks: [{ id: "partial-entity", start: 3, end: 5, state: "open" }],
      }),
    );
    expect(html).not.toContain("<mark");
    expect(html).toContain("A &amp; B");
  });
});
