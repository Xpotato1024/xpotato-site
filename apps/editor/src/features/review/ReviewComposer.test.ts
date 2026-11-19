import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewComposer } from "./ReviewComposer.js";

describe("review input labels", () => {
  it("makes the whole-block fallback explicit before the instruction is submitted", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewComposer, {
        selection: { quote: "段落の全文。", blockSource: "段落の全文。" },
        instruction: "",
        onInstruction: () => {},
        onSubmit: () => {},
      }),
    );
    expect(html).toContain("ブロック全体");
    expect(html).not.toContain("選択した文章");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>指摘を追加<\/button>/u);
  });

  it.each([false, true])(
    "keeps the field label separate from restored text (contextual: %s)",
    (contextual) => {
      const label = contextual ? "追加の指摘" : "指摘";
      const html = renderToStaticMarkup(
        createElement(ReviewComposer, {
          contextual,
          selection: { quote: "対象の文" },
          instruction: "対象を見ながら書きかけた指摘",
          onInstruction: () => {},
          onSubmit: () => {},
        }),
      );
      const inputId = html.match(/<textarea id="([^"]+)"/u)?.[1];
      expect(inputId).toBeDefined();
      expect(html).toContain(`<label for="${inputId}">${label}</label>`);
      expect(html).toMatch(/<textarea[^>]+>対象を見ながら書きかけた指摘<\/textarea>/u);
    },
  );
});
