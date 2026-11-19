import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReviewIndicator } from "./ReviewIndicator.js";

describe("review entry button", () => {
  it("returns the actual activation button even when pointer activation has not focused it", () => {
    const trigger = {} as HTMLButtonElement;
    const onSelect = vi.fn();
    const button = ReviewIndicator({
      marks: [{ id: "applied", start: 0, end: 4, state: "applied" }],
      onSelect,
    });
    button!.props.onClick({ currentTarget: trigger });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("applied", trigger);
  });

  it("identifies the action and the selected status when a block has several annotations", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewIndicator, {
        marks: [
          { id: "pending", start: 0, end: 4, state: "proposal" },
          { id: "applied", start: 5, end: 9, state: "applied" },
        ],
        activeCommentId: "applied",
        onSelect: () => {},
      }),
    );
    expect(html).toContain('aria-label="反映済み、この箇所を添削、指摘2件"');
    expect(html).toContain('data-review-state="applied"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('class="cms-review-action-icon"');
    expect(html).not.toContain("disabled");
  });

  it("does not advertise an enabled action when no handler exists", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewIndicator, {
        marks: [{ id: "applied", start: 0, end: 4, state: "applied" }],
      }),
    );
    expect(html).toContain('disabled=""');
  });
});
