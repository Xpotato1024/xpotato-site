import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { anchorSelection, type ReviewComment } from "@xpotato/editor-core/annotations";
import { createDraftForCollection } from "@xpotato/editor-core/draft";
import type { LocalDraft } from "../../data/storage.js";
import { ReviewPanel } from "./ReviewPanel.js";

describe("review composer target", () => {
  it.each(["stale", "removed"] as const)(
    "does not reuse a previous text selection when the selected annotation is %s",
    (state) => {
      const contentId = "11111111-1111-4111-8111-111111111111";
      const selection = { quote: "変更前", start: 4, end: 7 };
      const comment: ReviewComment = {
        id: "22222222-2222-4222-8222-222222222222",
        contentId,
        anchor: anchorSelection("旧前後。変更前。旧末尾", selection),
        instruction: "この箇所を確認",
        status: "open",
        createdAt: "2026-11-19T00:00:00Z",
      };
      const draft: LocalDraft = {
        id: "local-draft",
        source:
          createDraftForCollection({ collection: "blog", id: contentId }) +
          "新しい対象。別の箇所に変更前が残る。",
        path: "content/blog/example.mdx",
        sourceBranch: "main",
        workingBranch: "",
        baseCommit: "",
        savedAt: "2026-11-19T00:00:00Z",
        producer: "human",
        annotations: state === "stale" ? [comment] : [],
      };
      const html = renderToStaticMarkup(
        createElement(ReviewPanel, {
          draft,
          selection,
          selectedCommentId: comment.id,
          authenticated: false,
          composerDraft: {
            instruction: "別の指摘",
            followUps: { [comment.id]: "書きかけの追加指摘" },
          },
          onComposerChange: () => {},
          onChange: () => {},
          onDraft: () => {},
          onLocate: () => {},
          onError: () => {},
        }),
      );
      const composer = html.match(/<form class="review-composer[^"]*">[\s\S]*?<\/form>/u)?.[0];
      expect(composer).toBeDefined();
      expect(composer).not.toContain("selected-quote");
      expect(composer).toContain("書きかけの追加指摘");
      expect(composer).not.toContain("別の指摘");
      expect(composer).toMatch(/<button[^>]*disabled=""[^>]*>指摘を追加<\/button>/u);
      expect(html).not.toContain("選択箇所へ付け直す");
    },
  );
});
