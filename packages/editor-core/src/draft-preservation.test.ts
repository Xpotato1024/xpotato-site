import { describe, expect, it } from "vitest";
import { parseDraft, updateDraft, type DraftMetadata } from "./draft.js";

const id = "11111111-1111-4111-8111-111111111111";
const header = [
  "\uFEFF---",
  "# Preserve this editorial note and all authored YAML formatting.",
  "id: '" + id + "'",
  'title: "元の題名"  # title comment',
  "description: ''",
  "category: software",
  "tags: [react, explanation] # inline collection",
  "draft: true",
  "education: {subject: '制御', goals: [\"モデルを読む\", '設計する']}",
  "seo: {noindex: true, titleOverride: '表示名'}",
  "---",
  "",
].join("\r\n");
const originalBody = "\r\n## 見出し\r\n\r\n元の本文。\r\n";
const source = header + originalBody;

describe("body edits preserve the exact authored frontmatter", () => {
  it("changes only the body while preserving BOM, comments, quoting, flow style and CRLF", () => {
    const body = "\r\n## 見出し\r\n\r\n書き換えた本文。\r\n";
    expect(updateDraft(source, {}, body)).toBe(header + body);
    expect(updateDraft(source, {}, "")).toBe(header);
  });
  it("returns exact original bytes for an empty patch, identical body, or semantically identical metadata", () => {
    expect(updateDraft(source, {})).toBe(source);
    expect(updateDraft(source, {}, originalBody)).toBe(source);
    expect(
      updateDraft(source, {
        id,
        title: "元の題名",
        tags: ["react", "explanation"],
        education: { goals: ["モデルを読む", "設計する"], subject: "制御" },
        seo: { titleOverride: "表示名", noindex: true },
        updatedDate: undefined,
      }),
    ).toBe(source);
    expect(updateDraft(source, { draft: true }, "新しい本文\n")).toBe(header + "新しい本文\n");
  });
  it("does not mistake real nested or array edits for a no-op and preserves untouched metadata comments", () => {
    const changed = updateDraft(source, {
      tags: ["explanation", "react"],
      education: { subject: "設計", goals: ["モデルを読む"] },
    });
    expect(parseDraft(changed).data.tags).toEqual(["explanation", "react"]);
    expect(parseDraft(changed).data.education).toEqual({
      subject: "設計",
      goals: ["モデルを読む"],
    });
    expect(parseDraft(changed).body).toBe(originalBody);
    expect(changed).toContain('title: "元の題名" # title comment');
    expect(parseDraft(updateDraft(source, { seo: undefined })).data.seo).toBeUndefined();
  });
  it("does not silently delete ContentId even when an untyped patch requests undefined", () => {
    expect(() =>
      updateDraft(source, { id: undefined } as unknown as Partial<DraftMetadata>),
    ).toThrow("CONTENT_ID_IMMUTABLE");
  });
});
