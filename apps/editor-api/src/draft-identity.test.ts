import { describe, expect, it } from "vitest";
import { draftPath } from "@xpotato/editor-core/draft";
import { createDraftRecord } from "./media.js";
import { DraftStore } from "./state.js";
import { MemoryBucket } from "./test-bucket.js";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const contentId = "33333333-3333-4333-8333-333333333333";
const input = {
  id: firstId,
  contentId,
  branch: "content/ai-draft",
  commit: "a".repeat(40),
  sourcePath: "content/projects/example.mdx",
};

describe("one private draft per article work branch", () => {
  it("concurrent device IDs reuse one private draft", async () => {
    const store = new DraftStore(new MemoryBucket());
    const records = await Promise.all([
      createDraftRecord(store, input),
      createDraftRecord(store, { ...input, id: secondId }),
    ]);
    expect(records[0]!.id).toBe(records[1]!.id);
    const { state } = await store.read();
    expect(Object.values(state.drafts)).toHaveLength(1);
    expect(state.usedBytes).toBe(0);
  });

  it("reusing a draft preserves its newer commit, media and review revision", async () => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    await store.transact((state) => {
      const draft = state.drafts[firstId]!;
      draft.commit = "b".repeat(40);
      draft.revision = 7;
      draft.assets = { diagram: secondId };
      draft.review = { revision: 2, comments: [] };
    });
    const before = (await store.read()).state.drafts[firstId];
    const reused = await createDraftRecord(store, { ...input, id: secondId });
    expect(reused).toEqual(before);
    expect((await store.read()).state.drafts[firstId]).toEqual(before);
  });

  it.each([
    { contentId: "44444444-4444-4444-8444-444444444444" },
    { branch: "content/other-article" },
    { sourcePath: "content/projects/other.mdx" },
  ])("rejects an existing ID reused for a different identity: %j", async (change) => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    const before = (await store.read()).state;
    await expect(createDraftRecord(store, { ...input, ...change })).rejects.toThrow(
      "CONTENT_ID_IMMUTABLE",
    );
    expect((await store.read()).state).toEqual(before);
  });

  it("rejects the same article branch under a different source path", async () => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    await expect(
      createDraftRecord(store, {
        ...input,
        id: secondId,
        sourcePath: "content/projects/renamed.mdx",
      }),
    ).rejects.toThrow("DRAFT_MEDIA_IDENTITY_MISMATCH");
    expect(Object.values((await store.read()).state.drafts)).toHaveLength(1);
  });

  it("does not choose an arbitrary record when older clients created duplicates", async () => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    await store.transact((state) => {
      state.drafts[secondId] = { ...state.drafts[firstId]!, id: secondId };
    });
    const before = (await store.read()).state;
    await expect(createDraftRecord(store, input)).rejects.toThrow("DRAFT_MEDIA_AMBIGUOUS");
    expect((await store.read()).state).toEqual(before);
  });

  it("uses the documented source path for a legacy record without one", async () => {
    const store = new DraftStore(new MemoryBucket());
    const sourcePath = draftPath(contentId);
    await createDraftRecord(store, { ...input, sourcePath });
    await store.transact((state) => {
      delete state.drafts[firstId]!.sourcePath;
    });
    expect((await createDraftRecord(store, { ...input, id: secondId, sourcePath })).id).toBe(
      firstId,
    );
  });

  it("does not resurrect a deleted ID but allows a new private draft identity", async () => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    await store.transact((state) => {
      state.drafts[firstId]!.state = "deleted";
    });
    await expect(createDraftRecord(store, input)).rejects.toThrow("DRAFT_NOT_FOUND");
    expect((await createDraftRecord(store, { ...input, id: secondId })).id).toBe(secondId);
    expect((await store.read()).state.drafts[firstId]!.state).toBe("deleted");
  });

  it("keeps a separate private draft for a different work branch", async () => {
    const store = new DraftStore(new MemoryBucket());
    await createDraftRecord(store, input);
    const other = await createDraftRecord(store, {
      ...input,
      id: secondId,
      branch: "content/separate-revision",
    });
    expect(other.id).toBe(secondId);
    expect(Object.values((await store.read()).state.drafts)).toHaveLength(2);
  });
});
