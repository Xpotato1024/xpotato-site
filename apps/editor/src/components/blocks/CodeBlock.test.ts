import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock.js";

describe("math block controls", () => {
  it("shows the description separately from the current print checkbox value", () => {
    for (const print of [true, false]) {
      const html = renderToStaticMarkup(
        createElement(CodeBlock, {
          source:
            '```math label="数式表示のサンプル"' +
            (print ? ' print="source"' : "") +
            "\n\\sigma\n```",
          onChange: () => {},
        }),
      );
      expect(html).toContain('value="数式表示のサンプル"');
      expect(html).not.toContain("cms-field-error");
      expect(html.includes('type="checkbox" checked=""')).toBe(print);
    }
  });
});
