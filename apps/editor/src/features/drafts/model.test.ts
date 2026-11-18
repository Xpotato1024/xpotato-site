import { describe, expect, it } from "vitest";
import {
  createLocalDraft,
  acceptGitSaveResult,
  mergeGitSaveResult,
  mergeMediaSyncResult,
  parseLocalDraft,
} from "./model.js";
import type { SeriesRecord, SeriesRegistry } from "@xpotato/content-contracts/series";
import type { TaxonomySnapshot } from "@xpotato/editor-core/draft";

const manifest: TaxonomySnapshot = {
  contractVersion: 1,
  categories: { blog: ["software"], notes: [], tools: [] },
  tags: [],
  modules: [],
};
const series = (title: string, id = "series-one"): SeriesRecord => ({
  id,
  slug: id,
  title,
  description: "",
  kind: "series",
  status: "ongoing",
  entries: [],
});
const registry = (...entries: SeriesRecord[]): SeriesRegistry => ({
  schemaVersion: 1,
  series: entries,
});

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
  it("records success once without reapplying sent series edits over later local changes", () => {
    const base = registry(series("before"));
    const sent = registry(series("sent"));
    const continued = registry(series("typed while saving"));
    const submitted = {
      ...createLocalDraft(),
      pendingRegistryChanges: { series: sent, seriesBase: base },
    };
    const current = {
      ...submitted,
      source: "latest source",
      pendingRegistryChanges: { series: continued, seriesBase: base },
    };
    const result = acceptGitSaveResult(current, submitted, "c".repeat(40), manifest);
    expect(result.registryConflict).toBe(false);
    expect(result.draft.source).toBe(current.source);
    expect(result.draft.pendingRegistryChanges).toEqual({ series: continued, seriesBase: sent });
    const afterResponse = { ...result.draft, source: "typed after response" };
    const repeated = acceptGitSaveResult(afterResponse, submitted, "c".repeat(40), manifest);
    expect(repeated.registryConflict).toBe(false);
    expect(repeated.draft).toBe(afterResponse);
  });
  it("keeps the successful commit and unsaved series when an in-flight edit conflicts", () => {
    const before = registry(series("before"), series("other before", "other"));
    const fetched = registry(series("before"), series("remote edit", "other"));
    const sent = registry(series("sent"), series("remote edit", "other"));
    const submitted = {
      ...createLocalDraft(),
      pendingRegistryChanges: { series: sent, seriesBase: fetched },
    };
    const current = {
      ...submitted,
      source: "latest source",
      pendingRegistryChanges: {
        series: registry(series("sent"), series("local edit during save", "other")),
        seriesBase: before,
      },
    };
    const result = acceptGitSaveResult(current, submitted, "d".repeat(40), manifest);
    expect(result.registryConflict).toBe(true);
    expect(result.draft.pendingRegistryChanges).toBe(current.pendingRegistryChanges);
    expect(result.draft.source).toBe(current.source);
    expect(result.draft.baseCommit).toBe("d".repeat(40));
    expect(result.draft.syncedCommit).toBe("d".repeat(40));
    expect(result.draft.syncedSource).toBe(submitted.source);
    expect(result.draft.registrySnapshot).toBe(manifest);
  });
});
