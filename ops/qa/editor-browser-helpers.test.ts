import type { Page } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalDraft } from "../../apps/editor/src/data/storage.js";
import { createLocalDraft } from "../../apps/editor/src/features/drafts/model.js";
import { anchorSelection, type ReviewComment } from "@xpotato/editor-core/annotations";
import { parseDraft } from "@xpotato/editor-core/draft";
import { savedDraft } from "./editor-browser-helpers.mjs";

function savedPage(...revisions: (LocalDraft | undefined)[]) {
  let index = 0;
  const read = vi.fn(async () => revisions[Math.min(index++, revisions.length - 1)]);
  const page = {
    locator: () => ({ filter: () => ({ waitFor: async () => {} }) }),
    evaluate: read,
  } as unknown as Page;
  return { page, read };
}

function annotatedDraft(draft: LocalDraft): LocalDraft {
  const body = "指摘を付ける本文。";
  const comment: ReviewComment = {
    id: "22222222-2222-4222-8222-222222222222",
    contentId: parseDraft(draft.source).data.id,
    anchor: anchorSelection(body, { quote: body, start: 0, end: body.length }),
    instruction: "具体例を補ってください。",
    createdAt: draft.savedAt,
    status: "open",
  };
  return { ...draft, source: draft.source + body, annotations: [comment] };
}

describe("persisted draft revision gate", () => {
  afterEach(() => vi.useRealTimers());

  it("reads a fresh draft without requiring an annotation field", async () => {
    const draft = createLocalDraft();
    expect(draft.annotations).toBeUndefined();
    const { page } = savedPage(draft);
    expect(await savedDraft(page)).toBe(draft);
    expect(draft.annotations).toBeUndefined();
  });

  it("waits through the unannotated revision until the first review is persisted", async () => {
    vi.useFakeTimers();
    const next = annotatedDraft(createLocalDraft());
    const { annotations: _annotations, ...previous } = next;
    const { page, read } = savedPage(previous, next);
    const result = savedDraft(page, { source: next.source, annotationCount: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toBe(next);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("requires both the exact source and exact annotation count", async () => {
    vi.useFakeTimers();
    const next = annotatedDraft(createLocalDraft());
    const { page, read } = savedPage(
      { ...next, source: next.source + "古い本文" },
      { ...next, annotations: [] },
      next,
    );
    const result = savedDraft(page, { source: next.source, annotationCount: 1 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe(next);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it.each(["missing", "empty", "wrong shape"])(
    "fails when the expected annotation never persists (%s)",
    async (state) => {
      vi.useFakeTimers();
      const next = annotatedDraft(createLocalDraft());
      const { annotations: _annotations, ...previous } = next;
      const invalid =
        state === "missing"
          ? previous
          : { ...previous, annotations: state === "empty" ? [] : { length: 1 } };
      const { page } = savedPage(invalid as LocalDraft);
      const result = expect(
        savedDraft(page, { source: next.source, annotationCount: 1 }),
      ).rejects.toThrow("Expected draft revision did not reach local storage");
      await vi.advanceTimersByTimeAsync(15000);
      await result;
    },
  );
});
