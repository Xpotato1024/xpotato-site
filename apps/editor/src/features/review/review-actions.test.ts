import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  applyReviewProposal,
  locateAnchor,
  validateReviewComments,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";
import { followUpReviewComment, reviewCommentSelection } from "./review-actions.js";

const body = "前の文。\n\n結果は正しい。\n\n次の文。";
const quote = "結果は正しい。";
const original: ReviewComment = {
  id: "22222222-2222-4222-8222-222222222222",
  contentId: "11111111-1111-4111-8111-111111111111",
  anchor: anchorSelection(body, {
    quote,
    start: body.indexOf(quote),
    end: body.indexOf(quote) + quote.length,
  }),
  instruction: "確認条件を補う",
  createdAt: "2026-11-19T00:00:00Z",
  status: "open",
  proposal: {
    id: "proposal",
    expected: quote,
    replacement: "この条件では結果が一致した。",
    reason: "確認できた範囲を示す",
    receivedAt: "2026-11-19T00:00:01Z",
  },
};

describe("contextual review actions", () => {
  it("adds a new correction on the applied text without changing the prior proposal or body", () => {
    const applied = applyReviewProposal(body, original);
    const before = JSON.stringify(applied);
    const selection = reviewCommentSelection(applied.body, applied.comment);
    expect(selection?.quote).toBe(original.proposal!.replacement);
    expect(applied.body.slice(selection!.start, selection!.end)).toBe(selection!.quote);

    const followUp = followUpReviewComment(applied.body, applied.comment, " 条件の値も記す ");
    expect(followUp.id).not.toBe(applied.comment.id);
    expect(followUp.contentId).toBe(original.contentId);
    expect(followUp.anchor.quote).toBe(original.proposal!.replacement);
    expect(followUp.instruction).toBe("条件の値も記す");
    expect(followUp.status).toBe("open");
    expect(followUp.proposal).toBeUndefined();
    expect(locateAnchor(applied.body, followUp.anchor)).toEqual({
      start: selection!.start,
      end: selection!.end,
    });
    expect(validateReviewComments([applied.comment, followUp], original.contentId)).toHaveLength(2);
    expect(JSON.stringify(applied)).toBe(before);
  });

  it.each(["open", "resolved", "rejected"] as const)(
    "keeps a %s decision intact when adding another instruction to the same current text",
    (status) => {
      const previous: ReviewComment = { ...original, status };
      const before = JSON.stringify(previous);
      const followUp = followUpReviewComment(body, previous, "用語を説明する");
      expect(followUp.anchor.quote).toBe(quote);
      expect(followUp.id).not.toBe(previous.id);
      expect(JSON.stringify(previous)).toBe(before);
    },
  );

  it("refuses stale, ambiguous or deleted targets rather than reusing an older selection", () => {
    const applied = applyReviewProposal(body, original);
    const changed = applied.body.replace(original.proposal!.replacement, "変更された本文。");
    const ambiguous: ReviewComment = {
      ...original,
      anchor: { quote, prefix: "", suffix: "" },
    };
    const deleted: ReviewComment = {
      ...applied.comment,
      proposal: { ...original.proposal!, replacement: "" },
    };
    for (const [source, comment] of [
      [changed, applied.comment],
      [quote + quote, ambiguous],
      [body.replace(quote, ""), deleted],
    ] as const) {
      expect(reviewCommentSelection(source, comment)).toBeNull();
      expect(() => followUpReviewComment(source, comment, "追加の指摘")).toThrow(
        "本文を選び直してください",
      );
    }
  });
});
