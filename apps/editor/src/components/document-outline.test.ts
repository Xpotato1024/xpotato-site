import { describe, expect, it } from "vitest";
import { buildDocumentOutline } from "./document-outline.js";

describe("document outline", () => {
  it("distinguishes structural groups from their own headings and preserves source destinations", () => {
    const body =
      '<Group>\n\n## はじめに\n\n本文です。\n\n<Figure asset="demo" alt="写真" />\n\n<Group>\n\n### 詳細\n\n続き。\n\n</Group>\n\n</Group>';
    const entries = buildDocumentOutline(body);
    expect(entries.map((entry) => entry.title)).toEqual([
      "グループ 1",
      "はじめに",
      "グループ 2",
      "詳細",
    ]);
    expect(entries.filter((entry) => entry.group).map((entry) => entry.detail)).toEqual([
      "4ブロック",
      "2ブロック",
    ]);
    const heading = entries.find((entry) => entry.title === "はじめに")!;
    expect(body.slice(heading.start, heading.end)).toBe("## はじめに");
    expect(entries.filter((entry) => entry.title === "はじめに")).toHaveLength(1);
  });

  it("leaves incomplete MDX untouched while its outline is unavailable", () => {
    expect(buildDocumentOutline("<Group>\n\n## 途中")).toEqual([]);
  });
});
