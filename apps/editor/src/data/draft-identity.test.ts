import { describe, expect, it } from "vitest";
import { parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import { createLocalDraft } from "../features/drafts/model.js";
import { localDraftIdentity, matchingLocalDrafts, mergeGitReopen } from "./draft-identity.js";

function fixture() {
  const draft = createLocalDraft();
  return {
    ...draft,
    sourceBranch: "content/article",
    workingBranch: "content/article",
    baseCommit: "a".repeat(40),
    baseSource: draft.source,
    syncedCommit: "a".repeat(40),
    syncedSource: draft.source,
  };
}

describe("Git draft identity", () => {
  it("matches ContentId and work location without depending on title or Git revision", () => {
    const draft = fixture();
    const otherTitle = {
      ...draft,
      id: crypto.randomUUID(),
      source: updateDraft(draft.source, { title: "改題した原稿" }),
      baseCommit: "b".repeat(40),
    };
    const unrelated = [
      { ...draft, id: crypto.randomUUID(), workingBranch: "content/other" },
      { ...draft, id: crypto.randomUUID(), path: "content/projects/other.mdx" },
      { ...draft, id: crypto.randomUUID(), source: createLocalDraft().source },
      { ...draft, id: crypto.randomUUID(), archived: true },
    ];
    expect(
      matchingLocalDrafts([draft, otherTitle, ...unrelated], localDraftIdentity(draft)!),
    ).toEqual([draft, otherTitle]);
  });

  it("keeps a syntactically unfinished edit associated with its saved ContentId", () => {
    const draft = fixture();
    const editing = { ...draft, source: "---\ntitle: [" };
    expect(localDraftIdentity(editing)?.contentId).toBe(parseDraft(draft.source).data.id);
    expect(matchingLocalDrafts([editing], localDraftIdentity(draft)!)).toEqual([editing]);
    expect(localDraftIdentity({ ...createLocalDraft(), source: "---\ntitle: [" })).toBeNull();
  });

  it("keeps local-only revisions from separate source branches distinct", () => {
    const draft = { ...fixture(), workingBranch: "" };
    expect(
      matchingLocalDrafts(
        [draft, { ...draft, id: crypto.randomUUID(), sourceBranch: "main" }],
        localDraftIdentity(draft)!,
      ),
    ).toEqual([draft]);
  });
});

describe("reopening a Git workspace", () => {
  it("refreshes an unchanged source in place and retains its own review and private identity", () => {
    const current = {
      ...fixture(),
      annotations: [],
      remoteDraftId: crypto.randomUUID(),
      remoteRevision: 5,
    };
    const incomingSource = updateDraft(current.source, { title: "Gitで更新" });
    const incoming = {
      ...fixture(),
      source: incomingSource,
      baseSource: incomingSource,
      baseCommit: "b".repeat(40),
      syncedSource: incomingSource,
      syncedCommit: "b".repeat(40),
    };
    const reopened = mergeGitReopen(current, incoming);
    expect(reopened).toMatchObject({
      id: current.id,
      source: incomingSource,
      baseCommit: incoming.baseCommit,
      remoteDraftId: current.remoteDraftId,
      remoteRevision: 5,
      annotations: [],
    });
  });

  it("retains unsaved source and its conflict base when Git advances", () => {
    const saved = fixture();
    const current = { ...saved, source: updateDraft(saved.source, { title: "この端末の編集" }) };
    const incoming = {
      ...saved,
      source: updateDraft(saved.source, { title: "Gitの編集" }),
      baseCommit: "b".repeat(40),
    };
    expect(mergeGitReopen(current, incoming)).toBe(current);
  });

  it("retains registry changes and their original base even when the article itself is unchanged", () => {
    const current = {
      ...fixture(),
      pendingRegistryChanges: {
        taxonomy: [{ namespace: "tags" as const, id: "draft-tag", label: "編集中" }],
      },
    };
    expect(mergeGitReopen(current, { ...fixture(), baseCommit: "b".repeat(40) })).toBe(current);
  });
});
