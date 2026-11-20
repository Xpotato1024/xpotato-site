import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  blockTemplates,
  moduleChildKinds,
  readModuleSource,
  createBlockDocument,
  deleteRegion,
  insertRegion,
  updateModuleChildren,
  writeBlockDocument,
} from "@xpotato/editor-core/blocks";
import { validatePortableMdx } from "@xpotato/portable-content";
import { previewDocument } from "../../preview.js";
import { contentModuleRegistry } from "../../../../../content/registry/content-modules.js";
import { ModuleBlock } from "./ModuleBlock.js";
import { hasNestedEditor } from "./RegionContent.js";
import { allowedBlockKinds } from "./BlockPalette.js";

type ChildRenderer = Parameters<typeof ModuleBlock>[0]["renderChildren"];

describe("nested comparison and diagnostic controls", () => {
  it("offers an actual nested editor for every advertised container and no parent-only root blocks", () => {
    for (const record of contentModuleRegistry) {
      expect(hasNestedEditor(record.id), record.id).toBe(record.allowsChildren);
    }
    for (const name of ["Step", "DiagnosticItem", "ComparisonCase"]) {
      expect(allowedBlockKinds()).not.toContain(name);
      expect(allowedBlockKinds("Group")).not.toContain(name);
    }
    expect(allowedBlockKinds("Comparison")).toEqual(["ComparisonCase"]);
    expect(allowedBlockKinds("ComparisonCase")).toContain("Figure");
    expect(allowedBlockKinds("DiagnosticItem")).toContain("paragraph");
  });

  it("edits and returns case and diagnostic children through the normal nested editor", () => {
    for (const source of [
      blockTemplates.ComparisonCase,
      '<DiagnosticItem symptom="症状" check="確認" />',
    ]) {
      const change = vi.fn();
      const childEditor = vi.fn<ChildRenderer>((_body, _offset, _parent, apply) => {
        apply("\n\n編集した補足。\n\n");
        return createElement("p", null, "子のエディタ");
      });
      const html = renderToStaticMarkup(
        createElement(ModuleBlock, { source, onChange: change, renderChildren: childEditor }),
      );
      expect(childEditor).toHaveBeenCalledOnce();
      expect(html).toContain("子のエディタ");
      expect(change).toHaveBeenCalledOnce();
      expect(readModuleSource(change.mock.calls[0]![0])?.children?.trim()).toBe("編集した補足。");
      expect(readModuleSource(change.mock.calls[0]![0])?.props).toEqual(
        readModuleSource(source)?.props,
      );
    }
  });

  it("new comparisons omit meaningless settings and old comparisons retain their original editing vocabulary", () => {
    const children = vi.fn<ChildRenderer>(() => createElement("p", null, "内容"));
    const html = renderToStaticMarkup(
      createElement(ModuleBlock, {
        source: blockTemplates.Comparison,
        onChange: () => {},
        renderChildren: children,
      }),
    );
    expect(html).not.toContain("設定");
    expect(html).toContain("cms-comparison-grid");
    const legacyChildren = vi.fn<ChildRenderer>(() => createElement("p", null, "以前の内容"));
    const legacy = renderToStaticMarkup(
      createElement(ModuleBlock, {
        source: '<Comparison leftLabel="A" rightLabel="B">\n\n本文。\n\n</Comparison>',
        onChange: () => {},
        renderChildren: legacyChildren,
      }),
    );
    expect(legacy).toContain("設定");
    expect(legacy).not.toContain("cms-comparison-grid");
    expect(legacyChildren.mock.calls[0]?.[4]).toEqual(moduleChildKinds.Group);
  });

  it("warns without changing incomplete conditions and recovers after a condition is added", async () => {
    const original = blockTemplates.Comparison;
    const document = createBlockDocument(readModuleSource(original)!.children!);
    const remaining = deleteRegion(deleteRegion(document, 2), 1);
    const incomplete = updateModuleChildren(original, writeBlockDocument(remaining));
    const restored = updateModuleChildren(
      incomplete,
      writeBlockDocument(insertRegion(remaining, document.regions[1]!.source, 0)),
    );
    const empty = updateModuleChildren(original, "");
    const notice = "比較には条件を2つ以上追加してください。";
    for (const [source, warning] of [
      [incomplete, true],
      [empty, true],
      [restored, false],
    ] as const) {
      const change = vi.fn();
      const children = vi.fn<ChildRenderer>((body) => createElement("pre", null, body));
      const html = renderToStaticMarkup(
        createElement(ModuleBlock, { source, onChange: change, renderChildren: children }),
      );
      expect(html.includes(notice)).toBe(warning);
      expect(change).not.toHaveBeenCalled();
      expect(children.mock.calls[0]?.[0]).toBe(readModuleSource(source)?.children);
      const preview = await previewDocument(
        '---\nid: "11111111-1111-4111-8111-111111111111"\ntitle: 比較\ndescription: 比較の確認\ncategory: software\ntags: []\ndraft: true\n---\n' +
          source,
      );
      expect(preview.warnings.includes(notice)).toBe(warning);
      expect(preview.html.includes(notice)).toBe(warning);
      expect(validatePortableMdx(source).length > 0).toBe(warning);
    }
    expect(incomplete).toContain(document.regions[0]!.source);
    expect(restored).toContain(document.regions[0]!.source);
    expect(restored).toContain(document.regions[1]!.source);
  });
});
