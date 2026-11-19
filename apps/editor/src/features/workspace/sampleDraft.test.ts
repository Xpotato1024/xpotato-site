import { afterEach, describe, expect, it, vi } from "vitest";
import { applyReviewProposal, validateReviewComments } from "@xpotato/editor-core/annotations";
import { blockTree, moveBlockTo } from "@xpotato/editor-core/blocks";
import { parseDraft, validateDraft } from "@xpotato/editor-core/draft";
import { inspectImage } from "@xpotato/editor-core/image-inspection";
import { previewDocument } from "../../preview.js";
import { locateReviewComment, reviewMarkState } from "../review/review-marks.js";
import { createSampleDraft } from "./sampleDraft.js";

afterEach(() => vi.unstubAllGlobals());

describe("an explicitly opened local operation sample", () => {
  it("creates independent, clearly labelled drafts without storage or network effects", async () => {
    const fetch = vi.fn(() => {
      throw Error("sample must stay local");
    });
    const open = vi.fn(() => {
      throw Error("caller owns persistence");
    });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("indexedDB", { open });
    const first = await createSampleDraft();
    const second = await createSampleDraft();
    const parsed = parseDraft(first.draft.source);
    expect(parsed.data.title).toBe("操作サンプル：記事の構成と添削");
    expect(parsed.data.description).toContain("模擬データ");
    expect(parsed.data.draft).toBe(true);
    expect(first.draft.producer).toBe("ai");
    expect(first.draft.id).not.toBe(second.draft.id);
    expect(parsed.data.id).not.toBe(parseDraft(second.draft.source).data.id);
    expect(first.media[0]!.id).not.toBe(second.media[0]!.id);
    expect(first.draft.workingBranch).toBe("");
    expect(first.draft.baseCommit).toBe("");
    expect(first.draft.remoteDraftId).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("renders two editable groups, TeX, Python, and the supported local image", async () => {
    const { draft, media } = await createSampleDraft();
    const { body } = parseDraft(draft.source);
    expect(validateDraft(draft.source, "blog")).toEqual([]);
    const groups = blockTree(body).children!.filter((node) => node.name === "Group");
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.children!.some((node) => node.type === "heading")).toBe(true);
      expect(group.children!.some((node) => node.type === "paragraph")).toBe(true);
      expect(group.children!.some((node) => node.name === "Figure")).toBe(true);
    }
    const image = media[0]!;
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    expect(image.draftId).toBe(draft.id);
    expect(inspectImage(bytes, image.kind)).toMatchObject({
      mime: "image/png",
      width: 480,
      height: 160,
      animated: false,
    });
    expect(image.sha256).toBe(
      Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex"),
    );
    const preview = await previewDocument(draft.source, {
      media: [
        {
          assetId: image.assetId,
          src: "data:image/png;base64," + Buffer.from(bytes).toString("base64"),
        },
      ],
    });
    expect(preview.warnings).toEqual([]);
    expect(preview.html).toContain("<math");
    expect(preview.html).toContain("σ");
    expect(preview.html).toContain("python");
    expect(preview.html).toContain('alt="一つの枠の中に三つの文章ブロックを並べた図"');
    expect(body).not.toMatch(/https?:\/\//u);
  });

  it("keeps all four review states anchored while source contains only article text", async () => {
    const { draft } = await createSampleDraft();
    const { data, body } = parseDraft(draft.source);
    const comments = validateReviewComments(draft.annotations, data.id);
    expect(comments.map(reviewMarkState)).toEqual(["open", "proposal", "resolved", "applied"]);
    for (const comment of comments) {
      const location = locateReviewComment(body, comment);
      expect(location, comment.status).not.toBeNull();
      expect(body.slice(location!.start, location!.end)).toBe(
        comment.status === "applied" ? comment.proposal!.replacement : comment.anchor.quote,
      );
    }
    const applied = comments[3]!;
    expect(body).not.toContain(applied.proposal!.expected);
    const accepted = applyReviewProposal(body, comments[1]!);
    expect(accepted.comment.status).toBe("applied");
    expect(accepted.body).toContain(comments[1]!.proposal!.replacement);
    expect(accepted.body).not.toContain(comments[1]!.proposal!.expected);
    expect(body).not.toMatch(/<(?:mark|ins|del)|data-review|ReviewComment/iu);

    // Both a pending review and the already-applied sample retain their target after a group move.
    const moved = moveBlockTo(body, 1, 2);
    for (const comment of comments) expect(locateReviewComment(moved, comment)).not.toBeNull();
  });
});
