import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  applyReviewProposal,
  locateAnchor,
  validateReviewComments,
  type ReviewComment,
} from "@xpotato/editor-core/annotations";
import { sourceSelection } from "@xpotato/editor-core/blocks";
import {
  blockReviewSelection,
  followUpReviewComment,
  reviewCommentSelection,
} from "./review-actions.js";

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
  it("keeps a selected sentence inside a nested block when its toolbar opens a new review", () => {
    const source = "<Group>\n\n## 確認\n\n前の文。結果は正しい。次の文。\n\n</Group>";
    const block = "前の文。結果は正しい。次の文。";
    const start = source.indexOf(block);
    const selected = sourceSelection(block, quote, start);
    const target = blockReviewSelection(block, start, selected);
    expect(target).toEqual(selected);
    expect(target.quote).toBe(quote);
    expect(locateAnchor(source, anchorSelection(source, target))).toEqual({
      start: source.indexOf(quote),
      end: source.indexOf(quote) + quote.length,
    });
  });

  it("uses the current whole block when the prior selection belongs elsewhere or has collapsed", () => {
    const block = "新しい本文。";
    const start = 30;
    const previous = sourceSelection(block, "本文", start);
    for (const selected of [
      null,
      { ...previous, quote: "" },
      { ...previous, blockStart: 10 },
      { ...previous, blockSource: "変更前の本文。" },
    ]) {
      expect(blockReviewSelection(block, start, selected)).toEqual({
        quote: block,
        start,
        end: start + block.length,
        blockStart: start,
        blockEnd: start + block.length,
        blockSource: block,
      });
    }
  });

  it("does not silently expand an ambiguous text selection to the whole block", () => {
    const block = "同じ文。同じ文。";
    const target = blockReviewSelection(block, 0, sourceSelection(block, "同じ文。", 0));
    expect(target.quote).toBe("同じ文。");
    expect(() => anchorSelection(block, target)).toThrow("選択位置を特定できません");
  });

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
