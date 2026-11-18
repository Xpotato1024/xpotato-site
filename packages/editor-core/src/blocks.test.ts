import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createBlockDocument,
  writeBlockDocument,
  updateRegion,
  reorderRegion,
  insertRegion,
  deleteRegion,
  regionRange,
  readModuleSource,
  updateModuleProps,
  updateModuleChildren,
  sourceSelection,
  sourceBlocks,
  moveBlockTo,
  moduleInsertionOffset,
  blockTemplates,
} from "./blocks.js";
import { validatePortableMdx } from "@xpotato/portable-content";

describe("source-preserving editing regions", () => {
  const body =
    '\r\n## 見出し\r\n\r\n\r\n本文 **強調**。\r\n\r\n<Details summary="詳細" open>\r\n\r\n- 項目\r\n  - 入れ子\r\n\r\n</Details>\r\n';
  it("keeps original whitespace and CRLF through display, one-region editing and reordering", () => {
    const original = createBlockDocument(body);
    expect(writeBlockDocument(original)).toBe(body);
    const changed = updateRegion(original, original.regions[1]!.id, "変更した本文。");
    expect(writeBlockDocument(changed)).toBe(body.replace("本文 **強調**。", "変更した本文。"));
    const moved = reorderRegion(original, 0, 2);
    expect(moved.regions[2]!.id).toBe(original.regions[0]!.id);
    expect(writeBlockDocument(reorderRegion(moved, 2, 0))).toBe(body);
    for (let i = 0; i < moved.regions.length; i++) {
      const range = regionRange(moved, i);
      expect(writeBlockDocument(moved).slice(range.start, range.end)).toBe(
        moved.regions[i]!.source,
      );
    }
  });
  it("reattaches existing regions when an external edit inserts a preceding block", () => {
    const before = createBlockDocument("最初。\n\n最後。");
    const after = createBlockDocument("追加。\n\n最初。\n\n最後。", before);
    expect(after.regions[1]!.id).toBe(before.regions[0]!.id);
    expect(after.regions[2]!.id).toBe(before.regions[1]!.id);
    expect(new Set(after.regions.map((region) => region.id)).size).toBe(3);
  });
  it("does not remount or split a region when typing creates a new paragraph", () => {
    const original = createBlockDocument("最初。\n\n次。");
    const id = original.regions[0]!.id;
    const updated = updateRegion(original, id, "最初。\n\n入力した段落。\n\n- 新しい項目");
    expect(updated.regions).toHaveLength(2);
    expect(updated.regions[0]!.id).toBe(id);
    expect(writeBlockDocument(updated)).toBe("最初。\n\n入力した段落。\n\n- 新しい項目\n\n次。");
  });
  it("preserves unknown and unfinished MDX without executing or dropping it", () => {
    for (const source of [
      '<Unknown thing="a">\n\n原文\n\n</Unknown>',
      '<Gallery label="途中',
      "{unexpectedExpression()}",
      "<Figure asset={value} />",
    ]) {
      const original = createBlockDocument(source);
      expect(writeBlockDocument(original)).toBe(source);
      expect(readModuleSource(source)).toBeNull();
    }
  });
  it("inserts next to the selected block and removes the addition without changing other source", () => {
    const original = createBlockDocument(body);
    const inserted = insertRegion(original, "追加段落。", 0);
    expect(inserted.regions[1]!.source).toBe("追加段落。");
    expect(writeBlockDocument(deleteRegion(inserted, 1))).toBe(body);
    expect(original.regions.map((region) => region.source)).toEqual(
      sourceBlocks(body).map((block) => block.source),
    );
  });
  it("moves a block to any position without losing components", () => {
    const moved = moveBlockTo(body, 0, 2);
    expect(sourceBlocks(moved).map((block) => block.source)).toEqual([
      sourceBlocks(body)[1]!.source,
      sourceBlocks(body)[2]!.source,
      sourceBlocks(body)[0]!.source,
    ]);
    expect(validatePortableMdx(moved)).toEqual([]);
  });
  it("round-trips every existing collection body byte-for-byte", () => {
    const collections = ["articles", "notes", "pages", "tools", "projects"];
    let count = 0;
    for (const collection of collections) {
      const directory = resolve("content", collection);
      for (const entry of readdirSync(directory, { recursive: true })) {
        if (typeof entry !== "string" || !entry.endsWith(".mdx")) continue;
        const source = readFileSync(resolve(directory, entry), "utf8");
        const boundary = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(source);
        const content = boundary ? source.slice(boundary[0].length) : source;
        expect(writeBlockDocument(createBlockDocument(content)), collection + "/" + entry).toBe(
          content,
        );
        count++;
      }
    }
    expect(count).toBeGreaterThan(20);
  });
});

describe("semantic module fields", () => {
  const gallery =
    '<Gallery label="親 &amp; &quot;引用&quot; > 説明" layout="diagrams">\r\n  <Figure asset="first" alt="子の説明" caption="子の注釈" />\r\n  <Figure asset="second" alt="2枚目" />\r\n</Gallery>';
  it("reads only parent AST attributes, including entities and > within a quote", () => {
    const module = readModuleSource(gallery)!;
    expect(module.props).toEqual({ label: '親 & "引用" > 説明', layout: "diagrams" });
    expect(module.children).toBe(
      '\r\n  <Figure asset="first" alt="子の説明" caption="子の注釈" />\r\n  <Figure asset="second" alt="2枚目" />\r\n',
    );
    expect(gallery.slice(module.openingEnd, module.closingStart)).toBe(module.children);
  });
  it("adds optional fields while preserving children and CRLF exactly", () => {
    const before = readModuleSource(gallery)!;
    const after = updateModuleProps(gallery, { ...before.props, width: "wide" });
    expect(readModuleSource(after)!.children).toBe(before.children);
    expect(readModuleSource(after)!.props).toEqual({ ...before.props, width: "wide" });
    expect(validatePortableMdx(after)).toEqual([]);
  });
  it("encodes booleans as bare MDX attrs and omits false without expression syntax", () => {
    const source = '<Details summary="詳細">\n\n内容\n\n</Details>';
    const open = updateModuleProps(source, { summary: "詳細", open: true });
    expect(open).toContain('<Details summary="詳細" open>');
    expect(readModuleSource(open)!.props.open).toBe(true);
    expect(updateModuleProps(open, { summary: "詳細", open: false })).toBe(source);
  });
  it("edits nested body while keeping the exact parent opening tag", () => {
    const changed = updateModuleChildren(gallery, '\n<Figure asset="third" alt="新しい画像" />\n');
    expect(changed.slice(0, readModuleSource(changed)!.openingEnd)).toBe(
      gallery.slice(0, readModuleSource(gallery)!.openingEnd),
    );
    expect(readModuleSource(changed)!.children).toBe(
      '\n<Figure asset="third" alt="新しい画像" />\n',
    );
  });
  it("supports nested items validated in their real container context", () => {
    const item = updateModuleProps(blockTemplates.DiagnosticItem, {
      symptom: "接続できない",
      check: "配線を確認",
      reason: "接触不良",
    });
    expect(validatePortableMdx("<DiagnosticList>\n" + item + "\n</DiagnosticList>")).toEqual([]);
    expect(() => updateModuleProps(gallery, { unknown: "unsupported" })).toThrow();
  });
  it("escapes new attribute strings and keeps unchanged non-attribute source", () => {
    const changed = updateModuleProps('<Figure asset="one" alt="元の説明" />', {
      asset: "one",
      alt: 'a "quote" & b < c > d',
    });
    expect(readModuleSource(changed)!.props.alt).toBe('a "quote" & b < c > d');
    expect(validatePortableMdx(changed)).toEqual([]);
  });
});

describe("annotation source anchors", () => {
  it("uses source offsets only for an unambiguous literal match", () => {
    expect(sourceSelection("前に **対象**。後。", "対象", 30)).toEqual({
      quote: "対象",
      blockStart: 30,
      blockEnd: 42,
      blockSource: "前に **対象**。後。",
      start: 35,
      end: 37,
    });
    expect(sourceSelection("同じ。同じ。", "同じ", 5).start).toBeUndefined();
    expect(sourceSelection("**太字** と本文", "太字 と本文", 0).start).toBeUndefined();
  });
});

describe("module insertion context", () => {
  it("keeps image insertion inside a gallery and inside a step's article body", () => {
    const gallery = '<Gallery>\n<Figure asset="one" alt="画像" />\n</Gallery>\n\n後の段落。';
    const afterFigure = gallery.indexOf(" />") + 3;
    expect(moduleInsertionOffset(gallery, afterFigure, "Figure")).toBe(afterFigure);
    const steps = '<Steps>\n<Step title="操作">\n\n説明。\n\n</Step>\n</Steps>';
    const afterParagraph = steps.indexOf("説明。") + "説明。".length;
    expect(moduleInsertionOffset(steps, afterParagraph, "Figure")).toBe(afterParagraph);
  });
  it("promotes an image after a restrictive direct parent while admitting its own child kind", () => {
    for (const [source, marker, child] of [
      ['<Steps>\n<Step title="操作">\n\n説明。\n\n</Step>\n</Steps>', "</Step>", "Step"],
      [
        '<DiagnosticList>\n<DiagnosticItem symptom="症状" check="確認" />\n</DiagnosticList>',
        " />",
        "DiagnosticItem",
      ],
      ["<ArticleEndnote>\n\n補記。\n\n</ArticleEndnote>", "補記。", "paragraph"],
    ]) {
      const point = source!.indexOf(marker!) + marker!.length;
      expect(moduleInsertionOffset(source!, point, "Figure")).toBe(source!.length);
      expect(moduleInsertionOffset(source!, point, child!)).toBe(point);
    }
  });
  it("promotes a non-image after a gallery and preserves document-end boundaries", () => {
    const body = '<Gallery>\n<Figure asset="one" alt="画像" />\n</Gallery>\n\n末尾。';
    const inside = body.indexOf(" />") + 3;
    const galleryEnd = body.indexOf("</Gallery>") + "</Gallery>".length;
    expect(moduleInsertionOffset(body, inside, "Demo")).toBe(galleryEnd);
    expect(moduleInsertionOffset(body, galleryEnd, "Demo")).toBe(galleryEnd);
    expect(moduleInsertionOffset(body, body.length, "Figure")).toBe(body.length);
  });
});
