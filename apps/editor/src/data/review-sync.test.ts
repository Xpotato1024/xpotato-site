import { describe, it, expect, vi, beforeEach } from "vitest";
import { articleReviewAnchor, type ReviewComment } from "@xpotato/editor-core/annotations";
import { parseDraft } from "@xpotato/editor-core/draft";
import { createLocalDraft } from "../features/drafts/model.js";
import { hasUnsyncedReview } from "./draft-identity.js";
import { syncDraftReview, mergeRemoteReview } from "./review-sync.js";
import type { RemoteDraft } from "./media-sync.js";
const mocks = vi.hoisted(() => ({ find: vi.fn(), request: vi.fn() }));
vi.mock("./media-sync.js", async (original) => ({
  ...(await original<typeof import("./media-sync.js")>()),
  findMediaSnapshot: mocks.find,
}));
vi.mock("./api.js", () => ({ request: mocks.request }));
const setup = () => {
  const draft = {
    ...createLocalDraft(),
    workingBranch: "content/test",
    baseCommit: "a".repeat(40),
  };
  const contentId = parseDraft(draft.source).data.id;
  const comment: ReviewComment = {
    id: crypto.randomUUID(),
    contentId,
    anchor: articleReviewAnchor(),
    instruction: "構成",
    createdAt: "2026-11-27",
    status: "open",
  };
  const remote: RemoteDraft = {
    id: crypto.randomUUID(),
    contentId,
    branch: draft.workingBranch,
    commit: draft.baseCommit,
    sourcePath: draft.path,
    revision: 4,
    lastEditedAt: "2026-11-27",
    state: "active",
    assets: {},
    review: { revision: 2, comments: [comment] },
  };
  return { draft, comment, remote };
};
beforeEach(() => {
  vi.resetAllMocks();
});
describe("review-only persistence", () => {
  it("recognizes an already synchronized review without posting", async () => {
    const { draft, comment, remote } = setup();
    mocks.find.mockResolvedValue({ draft: remote, assets: [] });
    const receipt = await syncDraftReview({ ...draft, annotations: [comment] });
    expect(receipt).toMatchObject({ reviewRevision: 2, syncedAnnotations: [comment] });
    expect(mocks.request).not.toHaveBeenCalled();
    expect(hasUnsyncedReview({ ...draft, ...receipt, annotations: [comment] })).toBe(false);
  });
  it("writes only private review data and preserves changes entered during save", async () => {
    const { draft, comment, remote } = setup();
    const newComment = { ...comment, instruction: "改稿する" };
    mocks.find.mockResolvedValue({ draft: remote, assets: [] });
    mocks.request.mockResolvedValue({
      review: { revision: 3, comments: [newComment] },
      revision: 5,
    });
    const receipt = await syncDraftReview({
      ...draft,
      reviewRevision: 2,
      annotations: [newComment],
    });
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith("/draft-review", {
      method: "POST",
      body: { id: remote.id, expectedRevision: 2, comments: [newComment] },
    });
    expect(
      hasUnsyncedReview({
        ...draft,
        ...receipt,
        annotations: [{ ...newComment, instruction: "追加変更" }],
      }),
    ).toBe(true);
  });
  it("refuses a stale revision and missing remote comments without a write", async () => {
    const { draft, comment, remote } = setup();
    mocks.find.mockResolvedValue({ draft: remote, assets: [] });
    await expect(
      syncDraftReview({
        ...draft,
        reviewRevision: 1,
        annotations: [{ ...comment, instruction: "競合" }],
      }),
    ).rejects.toThrow("別の端末");
    await expect(syncDraftReview({ ...draft, reviewRevision: 2, annotations: [] })).rejects.toThrow(
      "別の端末",
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("merges a remote change if the local baseline is unchanged and retains independent local additions", () => {
    const { draft, comment, remote } = setup();
    const extra = { ...comment, id: crypto.randomUUID(), instruction: "別の指摘" };
    const updated = { ...comment, instruction: "遠隔変更" };
    const result = mergeRemoteReview(
      { ...draft, annotations: [comment, extra], syncedAnnotations: [comment], reviewRevision: 2 },
      { ...remote, review: { revision: 3, comments: [updated] } },
    );
    expect(result.annotations).toEqual([updated, extra]);
    expect(result.syncedAnnotations).toEqual([updated]);
    expect(hasUnsyncedReview(result)).toBe(true);
    expect(() =>
      mergeRemoteReview(
        {
          ...draft,
          annotations: [{ ...comment, instruction: "端末変更" }],
          syncedAnnotations: [comment],
        },
        { ...remote, review: { revision: 3, comments: [updated] } },
      ),
    ).toThrow("別の端末");
  });
});
