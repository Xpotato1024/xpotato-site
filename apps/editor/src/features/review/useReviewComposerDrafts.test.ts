import { describe, expect, it } from "vitest";
import {
  updateReviewComposerDrafts,
  type ReviewComposerDrafts,
} from "./useReviewComposerDrafts.js";

describe("unfinished review input", () => {
  it("keeps general and contextual input independently for every local draft", () => {
    let drafts: ReviewComposerDrafts = {};
    drafts = updateReviewComposerDrafts(drafts, "draft-a", null, "通常の指摘を書きかけ");
    drafts = updateReviewComposerDrafts(drafts, "draft-a", "comment-1", "追加の指摘を書きかけ");
    drafts = updateReviewComposerDrafts(drafts, "draft-a", "comment-2", "別の箇所への指摘");
    drafts = updateReviewComposerDrafts(drafts, "draft-b", "comment-1", "別原稿の指摘");
    expect(drafts["draft-a"]).toEqual({
      instruction: "通常の指摘を書きかけ",
      followUps: {
        "comment-1": "追加の指摘を書きかけ",
        "comment-2": "別の箇所への指摘",
      },
    });
    expect(drafts["draft-b"]).toEqual({
      instruction: "",
      followUps: { "comment-1": "別原稿の指摘" },
    });
  });

  it("clears only submitted input without mutating the previous session state", () => {
    const current: ReviewComposerDrafts = {
      "draft-a": {
        instruction: "別の指摘",
        followUps: { "comment-1": "追加済みにする指摘", "comment-2": "まだ入力中" },
      },
      "draft-b": { instruction: "別原稿", followUps: {} },
    };
    const before = structuredClone(current);
    const next = updateReviewComposerDrafts(current, "draft-a", "comment-1", "");
    expect(next["draft-a"]).toEqual({
      instruction: "別の指摘",
      followUps: { "comment-1": "", "comment-2": "まだ入力中" },
    });
    expect(next["draft-b"]).toBe(current["draft-b"]);
    expect(current).toEqual(before);
  });
});
