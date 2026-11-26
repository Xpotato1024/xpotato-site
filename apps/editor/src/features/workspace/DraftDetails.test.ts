import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalDraft } from "../drafts/model.js";
import { changedSourceRange, DraftSummary, draftSavedTime } from "./DraftDetails.js";

describe("distinguishing local drafts", () => {
  it("shows save time to the second, work branch, source state and review count", () => {
    const draft = { ...createLocalDraft(), workingBranch: "content/article", savedAt: "2026-11-26T01:23:45.000Z" };
    const html = renderToStaticMarkup(createElement(DraftSummary, { draft }));
    expect(html).toContain("content/article");
    expect(html).toContain(draftSavedTime(draft.savedAt));
    expect(html).toContain("本文にGit未保存の変更");
    expect(html).toContain("添削 0件");
  });

  it("reports identical source without an invented change", () => {
    expect(changedSourceRange("同じ原稿\n", "同じ原稿\n")).toBeNull();
  });

  it("retains all differing ranges, not just a title or a leading excerpt", () => {
    expect(changedSourceRange("共通\n古い文\n共通の中間\n追記あり\n末尾", "共通\n新しい文\n共通の中間\n末尾")).toEqual({ line: 2, left: "古い文\n共通の中間\n追記あり", right: "新しい文\n共通の中間" });
  });

  it("shows an insertion without pretending the unchanged neighboring line differs", () => {
    expect(changedSourceRange("先頭\n末尾", "先頭\n追記\n末尾")).toEqual({ line: 2, left: "", right: "追記" });
  });

  it("distinguishes a trailing empty line from an absent range", () => {
    expect(changedSourceRange("本文", "本文\n")).toEqual({ line: 2, left: "", right: "（空行 1行）" });
  });
});
