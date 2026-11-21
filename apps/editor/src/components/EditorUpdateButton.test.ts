import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorUpdateButton } from "./EditorUpdateButton.js";

describe("editor update control", () => {
  it("shows an available update in both icon title and accessible label", () => {
    const html = renderToStaticMarkup(
      createElement(EditorUpdateButton, {
        ready: true,
        checking: false,
        disabled: false,
        onClick: vi.fn(),
      }),
    );
    expect(html).toContain('aria-label="CMSアプリの更新を適用"');
    expect(html).toContain("CMSアプリの更新を適用");
    expect(html).toContain('class="editor-update-button"');
  });
  it("indicates a check in progress and disables repeated actions", () => {
    const html = renderToStaticMarkup(
      createElement(EditorUpdateButton, {
        ready: false,
        checking: true,
        disabled: true,
        onClick: vi.fn(),
      }),
    );
    expect(html).toContain('aria-label="CMSアプリの更新を確認中"');
    expect(html).toContain("disabled");
  });
});
