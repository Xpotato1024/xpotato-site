import { describe, it, expect } from "vitest";
import {
  createDraft,
  parseDraft,
  updateDraft,
  validateDraft,
  draftPath,
  assertEditablePath,
  documentHandoff,
} from "./draft.js";
import { sourceBlocks, replaceBlock, moveBlock, moduleSource } from "./blocks.js";
import { mediaPolicy, assertMediaBudget, quotaState } from "./policy.js";
import { retentionDecision, canCollectAsset } from "./retention.js";
import {
  blogFrontmatterSchema,
  blogSourceFrontmatterSchema,
} from "@xpotato/content-contracts/content";
const id = "11111111-1111-4111-8111-111111111111";
const taxonomy = {
  contractVersion: 1 as const,
  categories: { blog: ["software"] },
  tags: ["javascript"],
  modules: ["Figure"],
};
describe("MDX is the single authoring source", () => {
  it("creates an undated draft without inventing publication metadata", () => {
    const d = parseDraft(createDraft("新しい記事", "software", id));
    expect(d.data.id).toBe(id);
    expect(d.data.pubDate).toBeUndefined();
    expect(d.data.draft).toBe(true);
    expect(blogSourceFrontmatterSchema.safeParse(d.data).success).toBe(true);
    expect(blogFrontmatterSchema.safeParse({ ...d.data, draft: false }).success).toBe(false);
  });
  it("does not modify body, line endings, existing metadata or identity during an edit", () => {
    const source =
      createDraft("元の題名", "software", id).replaceAll("\n", "\r\n") +
      "本文\r\n\r\n<!-- comment -->";
    const after = updateDraft(source, { title: "新しい題名" });
    expect(parseDraft(after).body).toBe(parseDraft(source).body);
    expect(after).toContain("\r\n");
    expect(() => updateDraft(after, { id: crypto.randomUUID() })).toThrow("CONTENT_ID_IMMUTABLE");
  });
  it("detects unknown taxonomy and dangerous MDX", () => {
    const source = updateDraft(
      createDraft("a", "software", id),
      { tags: ["unknown"] },
      "<script>alert(1)</script>",
    );
    expect(validateDraft(source, "blog", taxonomy)).toContain("TAG_UNKNOWN: unknown");
    expect(validateDraft(source, "blog", taxonomy).join(" ")).toContain("unapproved");
  });
  it("keeps stable URL IDs and forbids arbitrary git paths", () => {
    expect(draftPath(id)).toMatch(/^content\/articles\/[a-z0-9]{26}\.mdx$/u);
    for (const p of [
      ".github/workflows/x.yml",
      "content/articles/../x.mdx",
      "content/registry/secret.mdx",
      "content/articles/a.mdx/extra",
    ])
      expect(() => assertEditablePath(p)).toThrow();
  });
  it("exposes an exact commit handoff without granting publication", () => {
    const handoff = documentHandoff(
      createDraft("a", "software", id),
      "a".repeat(40),
      draftPath(id),
    );
    expect(handoff).toEqual(
      expect.objectContaining({
        commit: "a".repeat(40),
        contentId: id,
        publicationAuthorized: false,
      }),
    );
  });
});
describe("source-preserving block operations", () => {
  const body = '## 見出し\n\n段落に **強調**。\n\n<Figure asset="test" alt="説明" />\n';
  it("extracts blocks with exact source ranges", () => {
    const blocks = sourceBlocks(body);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) expect(body.slice(b.start, b.end)).toBe(b.source);
  });
  it("changes only the selected source range", () => {
    const output = replaceBlock(body, 1, "編集した段落。");
    expect(output).toBe(body.replace("段落に **強調**。", "編集した段落。"));
  });
  it("moves adjacent blocks without destroying other MDX", () => {
    const output = moveBlock(body, 0, 1);
    expect(sourceBlocks(output).map((b) => b.source)).toEqual([
      sourceBlocks(body)[1]!.source,
      sourceBlocks(body)[0]!.source,
      sourceBlocks(body)[2]!.source,
    ]);
  });
  it("refuses executable content and escapes attribute values", () => {
    expect(() => replaceBlock(body, 1, "{process.exit()}")).toThrow();
    expect(moduleSource("Figure", { asset: "test", alt: 'A & "B"' })).toContain(
      "&amp; &quot;B&quot;",
    );
    expect(() => moduleSource("script", {})).toThrow("MODULE_UNKNOWN");
  });
});
describe("one media budget and lifecycle policy", () => {
  it("distinguishes upload input from retained byte budgets", () => {
    expect(mediaPolicy.inputBytes).toBe(24 * 1024 * 1024);
    expect(() => assertMediaBudget("photo", 4 * 1024 * 1024 + 1)).toThrow();
    expect(() => assertMediaBudget("animation", 8 * 1024 * 1024)).not.toThrow();
    expect(quotaState(1_500_000_000).state).toBe("warning");
    expect(quotaState(1_990_000_000, 10_000_000).state).toBe("full");
  });
  const now = Date.parse("2026-11-17T00:00:00Z"),
    date = (days: number) => new Date(now - days * 86400000).toISOString();
  it.each([
    [0, "keep"],
    [30, "warn"],
    [60, "archive"],
    [90, "candidate"],
  ])("classifies %s days without deleting an active draft", (days, action) => {
    expect(retentionDecision({ lastEditedAt: date(days as number), state: "active" }, now)).toBe(
      action,
    );
  });
  it("requires the grace deadline, no review and no hold before deletion", () => {
    const d = { lastEditedAt: date(121), state: "delete_candidate" as const, deleteAfter: date(1) };
    expect(retentionDecision(d, now)).toBe("delete");
    expect(retentionDecision({ ...d, reviewUntil: date(-1) }, now)).toBe("keep");
    expect(retentionDecision({ ...d, holdUntil: date(-1) }, now)).toBe("keep");
  });
  it("never collects referenced, promoted or protected-in-progress assets", () => {
    const asset = {
      status: "rejected" as const,
      createdAt: date(60),
      rejectedAt: date(31),
      references: [],
    };
    expect(canCollectAsset(asset, now)).toBe(true);
    expect(canCollectAsset({ ...asset, references: ["draft"] }, now)).toBe(false);
    expect(canCollectAsset({ ...asset, status: "promoted" }, now)).toBe(false);
    expect(canCollectAsset({ ...asset, promoting: true }, now)).toBe(false);
  });
});
