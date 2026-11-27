import { describe, expect, it } from "vitest";
import {
  anchorSelection,
  articleReviewAnchor,
  reattachReviewComment,
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
  it("preserves an open orphan and its original proposal when the editor explicitly reattaches it", () => {
    const old = comment("前。旧本文。後。", "旧本文");
    old.proposal = {
      id: "old",
      expected: "旧本文",
      replacement: "修正",
      reason: "根拠",
      receivedAt: "2026-11-27",
    };
    const body = "前。新本文。後。";
    expect(locateAnchor(body, old.anchor)).toBeNull();
    expect(old.status).toBe("open");
    const next = reattachReviewComment(body, old, { quote: "新本文" });
    expect(next.id).toBe(old.id);
    expect(next.status).toBe("open");
    expect(next.proposal).toBeUndefined();
    expect(next.targetHistory?.[0]).toMatchObject({ anchor: old.anchor, proposal: old.proposal });
    expect(validateReviewComments([next], id)).toEqual([next]);
  });
  it("accepts an article-wide target without confusing it with an absent text anchor", () => {
    const c = { ...comment("本文", "本文"), anchor: articleReviewAnchor() };
    expect(validateReviewComments([c], id)).toEqual([c]);
    expect(locateAnchor("まったく別の本文", c.anchor)).toBeNull();
    expect(() => applyReviewProposal("本文", c)).toThrow("記事全体");
    expect(() =>
      validateReviewComments([{ ...c, anchor: { ...c.anchor, quote: "本文" } }], id),
    ).toThrow();
    expect(() =>
      importReviewProposals(
        {
          version: 1,
          contentId: id,
          proposals: [{ commentId, expected: "", replacement: "誤置換", reason: "" }],
        },
        id,
        [c],
      ),
    ).toThrow();
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
