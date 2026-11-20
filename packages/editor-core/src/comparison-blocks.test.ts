import { describe, expect, it } from "vitest";
import { validatePortableMdx } from "@xpotato/portable-content";
import {
  blockTemplates,
  createBlockDocument,
  deleteRegion,
  insertRegion,
  moduleChildKinds,
  moduleInsertionOffset,
  readModuleSource,
  reorderRegion,
  updateModuleChildren,
  updateModuleProps,
  updateRegion,
  writeBlockDocument,
} from "./blocks.js";

const condition = (label: string, body: string) =>
  `<ComparisonCase label="${label}">\n\n${body}\n\n</ComparisonCase>`;
const comparison = (children: string) => `<Comparison>\n\n${children}\n\n</Comparison>`;

describe("comparison condition editing", () => {
  it("creates three conditions and edits their labels and content without touching siblings", () => {
    const source = blockTemplates.Comparison;
    expect(validatePortableMdx(source)).toEqual([]);
    const outer = readModuleSource(source)!;
    const document = createBlockDocument(outer.children!);
    expect(document.regions).toHaveLength(3);
    const original = document.regions[1]!;
    const body = '## 確認\n\n説明と **強調**。\n\n<Figure asset="sample" alt="条件の図" />';
    const updated = updateModuleChildren(
      updateModuleProps(original.source, { label: "第三の選択肢ではなく条件B" }),
      `\n\n${body}\n\n`,
    );
    const result = updateModuleChildren(
      source,
      writeBlockDocument(updateRegion(document, original.id, updated)),
    );
    expect(validatePortableMdx(result)).toEqual([]);
    expect(result).toContain(body);
    expect(result).toContain(document.regions[0]!.source);
    expect(result).toContain(document.regions[2]!.source);
    expect(readModuleSource(updated)?.props.label).toBe("第三の選択肢ではなく条件B");
  });

  it("adds, reorders and deletes conditions as complete units, retaining image and text bytes", () => {
    const conditions = [
      condition("A", "元の文章。"),
      condition("B", '<Figure asset="sample" alt="比較画像" />\n\n画像の説明。'),
      condition("C", "最後の条件。"),
    ];
    const document = createBlockDocument(conditions.join("\n\n"));
    const added = insertRegion(document, condition("D", "追加した条件。"), 2);
    const moved = reorderRegion(added, 1, 3);
    expect(moved.regions[3]!.source).toBe(conditions[1]);
    const result = comparison(writeBlockDocument(deleteRegion(moved, 0)));
    expect(validatePortableMdx(result)).toEqual([]);
    const resultChildren = createBlockDocument(readModuleSource(result)!.children!);
    expect(
      resultChildren.regions.map((region) => readModuleSource(region.source)?.props.label),
    ).toEqual(["C", "D", "B"]);
    expect(result).toContain(conditions[1]);
  });

  it("admits more than six conditions and rejects missing or mixed condition boundaries", () => {
    const many = comparison(
      Array.from({ length: 8 }, (_, index) => condition(String(index + 1), "本文。")).join("\n\n"),
    );
    expect(validatePortableMdx(many)).toEqual([]);
    expect(validatePortableMdx(comparison(condition("A", "本文。"))).join(" ")).toContain(
      "at least two",
    );
    expect(validatePortableMdx(condition("A", "本文。")).join(" ")).toContain("inside Comparison");
    expect(validatePortableMdx(comparison(condition("A", "本文。") + "\n\n本文。"))).not.toEqual(
      [],
    );
    expect(
      validatePortableMdx(
        many.replace("<Comparison>", '<Comparison leftLabel="旧A" rightLabel="旧B">'),
      ),
    ).not.toEqual([]);
  });

  it("preserves the legacy two-label body and limits new insertion to actual condition interiors", () => {
    const body = '文章の順序を保つ。\n\n<Figure asset="sample" alt="比較図" />';
    const legacy = `<Comparison leftLabel="以前" rightLabel="現在">\n\n${body}\n\n</Comparison>`;
    const edited = updateModuleProps(legacy, { leftLabel: "旧条件", rightLabel: "新条件" });
    expect(readModuleSource(edited)?.children).toBe(readModuleSource(legacy)?.children);
    expect(validatePortableMdx(edited)).toEqual([]);
    const offset = legacy.indexOf("文章");
    expect(moduleInsertionOffset(legacy, offset, "Figure")).toBe(offset);
    const modern = blockTemplates.Comparison;
    const betweenCases = modern.indexOf("</ComparisonCase>") + "</ComparisonCase>".length + 1;
    expect(moduleInsertionOffset(modern, betweenCases, "Figure")).toBe(modern.length);
    const withinCase = modern.indexOf("条件Aの説明");
    expect(moduleInsertionOffset(modern, withinCase, "Figure")).toBe(withinCase);
  });

  it("offers full content inside conditions and diagnostics while retaining parent-only restrictions", () => {
    for (const name of ["ComparisonCase", "DiagnosticItem"]) {
      expect(moduleChildKinds[name]).toEqual(
        expect.arrayContaining(["paragraph", "Figure", "Group", "table"]),
      );
      expect(moduleChildKinds[name]).not.toEqual(expect.arrayContaining(["ComparisonCase"]));
    }
    expect(moduleChildKinds.Group).not.toContain("ComparisonCase");
    expect(moduleChildKinds.Gallery).toEqual(["Figure"]);
    expect(moduleChildKinds.Steps).toEqual(["Step"]);
    expect(moduleChildKinds.ArticleEndnote).toEqual(["paragraph"]);
    const supplement =
      '<DiagnosticList>\n\n<DiagnosticItem symptom="症状" check="確認">\n\n追加の説明。\n\n</DiagnosticItem>\n\n</DiagnosticList>';
    expect(validatePortableMdx(supplement)).toEqual([]);
    const grouped = comparison(
      condition("A", "<Group>\n\n本文。\n\n</Group>") + "\n\n" + condition("B", "本文。"),
    );
    expect(validatePortableMdx(grouped)).toEqual([]);
  });
});
