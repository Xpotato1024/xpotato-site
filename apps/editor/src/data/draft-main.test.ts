import { describe, it, expect } from "vitest";
import { acceptMainSync, conflictHandoff, mainSyncIdentity, mainSyncLabel } from "./draft-main.js";
import { createLocalDraft } from "../features/drafts/model.js";
import { updateDraft, parseDraft } from "@xpotato/editor-core/draft";
import type { DraftBranchSyncResult } from "@xpotato/editor-core/draft-branch";
const a = "a".repeat(40),
  b = "b".repeat(40),
  m = "c".repeat(40);
describe("local main-follow receipt", () => {
  it("advances only the Git baseline, preserving unsaved text, review and remote media identity", () => {
    const initial = createLocalDraft();
    const local = {
      ...initial,
      workingBranch: "content/test",
      baseCommit: a,
      baseSource: initial.source,
      syncedCommit: a,
      syncedSource: initial.source,
      source: updateDraft(initial.source, { title: "Unsaved" }),
      annotations: [],
      remoteDraftId: crypto.randomUUID(),
      remoteRevision: 7,
      reviewRevision: 2,
    };
    const input = mainSyncIdentity(local);
    const result: DraftBranchSyncResult = {
      status: "synced",
      branch: local.workingBranch,
      head: b,
      previousHead: a,
      main: m,
      ancestor: m,
      behind: 0,
      conflicts: [],
      manifest: { contractVersion: 1, categories: {}, tags: [], modules: [] },
    };
    const next = acceptMainSync(local, input, result);
    expect(next).toMatchObject({
      id: local.id,
      source: local.source,
      baseSource: local.baseSource,
      syncedSource: local.syncedSource,
      baseCommit: b,
      syncedCommit: b,
      annotations: [],
      remoteDraftId: local.remoteDraftId,
      remoteRevision: 7,
      reviewRevision: 2,
    });
    expect(acceptMainSync(next, input, result)).toBe(next);
    expect(() => acceptMainSync({ ...local, baseCommit: m }, input, result)).toThrow();
  });
  it("exports private conflict context without falsely labeling a different revision", () => {
    const initial = createLocalDraft();
    const local = {
      ...initial,
      workingBranch: "content/test",
      baseCommit: a,
      baseSource: initial.source,
    };
    const result: DraftBranchSyncResult = {
      status: "conflict",
      branch: local.workingBranch,
      head: a,
      main: m,
      ancestor: b,
      behind: 2,
      conflicts: [{ path: local.path, reason: "SAME_ARTICLE_CHANGED" }],
    };
    expect(conflictHandoff(local, result)).toMatchObject({
      expectedHead: a,
      main: m,
      ancestor: b,
      source: local.source,
      contentId: parseDraft(local.source).data.id,
    });
    expect(mainSyncLabel(result, { ...local, baseCommit: b })).toContain("未確認");
  });
});
