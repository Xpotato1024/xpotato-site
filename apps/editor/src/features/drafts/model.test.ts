import { describe, expect, it } from "vitest";
import {
  createLocalDraft,
  mergeGitSaveResult,
  mergeMediaSyncResult,
  parseLocalDraft,
} from "./model.js";

describe("draft changes while a remote operation is running", () => {
  it("keeps newly typed text but records the exact source saved to Git", () => {
    const submitted = {
      ...createLocalDraft(),
      workingBranch: "content/article",
      source: "submitted",
    };
    const current = { ...submitted, source: "typed while saving" };
    const result = mergeGitSaveResult(current, submitted, "a".repeat(40));
    expect(result.source).toBe("typed while saving");
    expect(result.syncedSource).toBe("submitted");
    expect(result.syncedCommit).toBe("a".repeat(40));
    expect(current.syncedCommit).toBeUndefined();
  });
  it("saves the submitted draft independently after the user opens another draft", () => {
    const submitted = createLocalDraft();
    const current = { ...createLocalDraft(), source: "another article" };
    const result = mergeGitSaveResult(current, submitted, "b".repeat(40));
    expect(result.id).toBe(submitted.id);
    expect(result.source).toBe(submitted.source);
    expect(current.source).toBe("another article");
    expect(current.syncedCommit).toBeUndefined();
  });
  it("media synchronization cannot roll the text back or update another draft", () => {
    const current = { ...createLocalDraft(), source: "latest text" };
    const response = {
      ...current,
      source: "older text",
      remoteDraftId: "remote",
      remoteRevision: 3,
    };
    expect(mergeMediaSyncResult(current, response)).toEqual({
      ...current,
      remoteDraftId: "remote",
      remoteRevision: 3,
    });
    const another = createLocalDraft();
    expect(mergeMediaSyncResult(another, response)).toBe(another);
  });
  it("incomplete source stays editable without inventing frontmatter", () => {
    expect(parseLocalDraft("---\nid: incomplete")).toBeNull();
    const draft = createLocalDraft();
    expect(parseLocalDraft(draft.source)?.data.draft).toBe(true);
  });
});
