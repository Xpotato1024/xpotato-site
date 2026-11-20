import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  locateAnchor,
  applyReviewProposal,
  importReviewProposals,
  validateReviewComments,
  type ReviewComment,
} from "./annotations.js";
const id = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";
function comment(body: string, quote: string, blockSource = body): ReviewComment {
  const start = body.indexOf(quote);
  return {
    id: commentId,
    contentId: id,
    instruction: "根拠を具体的に",
    createdAt: new Date().toISOString(),
    status: "open",
    anchor: anchorSelection(body, {
      quote,
      start,
      end: start + quote.length,
      blockStart: body.indexOf(blockSource),
      blockSource,
    }),
  };
}
describe("source-anchored review", () => {
  it("follows an unchanged block across reorder and preserves other edits on application", () => {
    const body = "前文。\n\n強度が上がる。\n\n後文。";
    const c = comment(body, "強度が上がる", "強度が上がる。");
    c.proposal = {
      id: "proposal",
      expected: "強度が上がる",
      replacement: "層の向きによって強度が変わる",
      reason: "条件を補う",
      receivedAt: "2026-11-18",
    };
    const changed = "後文を編集。\n\n強度が上がる。\n\n前文。";
    const applied = applyReviewProposal(changed, c);
    expect(applied.body).toBe("後文を編集。\n\n層の向きによって強度が変わる。\n\n前文。");
    expect(applyReviewProposal(applied.body, applied.comment).body).toBe(applied.body);
  });
  it("does not attach an orphan to a duplicate elsewhere or overwrite an edited target", () => {
    const c = comment("左の説明。\n\n同じ文章。\n\n右の説明。", "同じ文章", "同じ文章。");
    expect(locateAnchor("別の文。\n\n同じ文章。\n\n同じ文章。", c.anchor)).toBeNull();
    c.proposal = { id: "p", expected: "同じ文章", replacement: "修正", reason: "", receivedAt: "" };
    expect(() => applyReviewProposal("左の説明。\n\n新しい文章。\n\n右の説明。", c)).toThrow();
  });
  it("rejects proposals for another article, mismatched quotes, and duplicate comment IDs", () => {
    const c = comment("本文", "本文");
    expect(() =>
      importReviewProposals({ version: 1, contentId: "other", proposals: [] }, id, [c]),
    ).toThrow();
    expect(() =>
      importReviewProposals(
        {
          version: 1,
          contentId: id,
          proposals: [{ commentId, expected: "別の文", replacement: "x", reason: "" }],
        },
        id,
        [c],
      ),
    ).toThrow();
    expect(() => validateReviewComments([c, c], id)).toThrow();
    expect(
      importReviewProposals(
        {
          version: 1,
          contentId: id,
          proposals: [{ commentId, expected: "本文", replacement: "新しい本文", reason: "具体化" }],
        },
        id,
        [c],
      )[0]?.proposal?.replacement,
    ).toBe("新しい本文");
  });
});
