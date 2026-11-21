import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { documentKindIcons, draftKinds } from "../../features/workspace/StartWorkspace.js";
import { WorkspaceIcon } from "../WorkspaceIcon.js";
import { blockChoices, allowedBlockKinds } from "./BlockPalette.js";
import {
  blockTemplates,
  createBlockDocument,
  insertRegion,
  writeBlockDocument,
} from "@xpotato/editor-core/blocks";
import { mermaidInput } from "../../../../../ops/media/visuals/inputs.mjs";

describe("CMS refinements", () => {
  it("uses six distinct document type icons", () => {
    const names = draftKinds.map((item) => documentKindIcons[item.id]);
    expect(new Set(names).size).toBe(6);
    const icons = names.map((name) => renderToStaticMarkup(createElement(WorkspaceIcon, { name })));
    expect(new Set(icons).size).toBe(6);
  });

  it("offers a dedicated, round-trip-safe Mermaid block", () => {
    expect(blockChoices.find((choice) => choice.kind === "mermaid")?.label).toBe("Mermaid構成図");
    expect(allowedBlockKinds()).toContain("mermaid");
    const template = blockTemplates.mermaid;
    const match = /^```mermaid\n([\s\S]+)\n```$/u.exec(template);
    expect(match).not.toBeNull();
    const parsed = mermaidInput(match![1]!);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
    const document = createBlockDocument("前の文章\n\n後の文章");
    const updated = insertRegion(document, template, 0);
    const written = writeBlockDocument(updated);
    expect(written.indexOf("前の文章")).toBeLessThan(written.indexOf("flowchart TB"));
    expect(written.indexOf("flowchart TB")).toBeLessThan(written.indexOf("後の文章"));
    expect(writeBlockDocument(createBlockDocument(written))).toBe(written);
  });

  it("rejects active content and external URLs in source preview", () => {
    expect(() => mermaidInput("flowchart TB\n<script>alert(1)</script>")).toThrow();
    expect(() => mermaidInput("flowchart TB\nclick A https://example.org")).toThrow();
  });
});
