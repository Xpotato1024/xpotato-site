import { describe, expect, it } from "vitest";
import { blockTree, createBlockDocument, updateRegion, writeBlockDocument } from "./blocks.js";
import { blockTreeWithFootnoteReferences, insertFootnote, newFootnoteSource, readFootnoteDefinition, updateFootnoteContent } from "./footnotes.js";

describe("portable footnote blocks", () => {
  it("recognizes isolated references without saving the parse-only definitions", () => {
    const source = "本文[^architecture]。**追記[^static]**。";
    const tree = blockTreeWithFootnoteReferences(source);
    expect(tree.children).toHaveLength(1);
    expect(tree.children?.[0]?.children?.[1]).toMatchObject({ type: "footnoteReference", identifier: "architecture" });
    expect(source).toBe("本文[^architecture]。**追記[^static]**。");
    const unfinishedCode = "```text\n[^literal]";
    expect(blockTreeWithFootnoteReferences(unfinishedCode).children?.[0]?.value).toBe("[^literal]");
  });
  it("opens a complete article without rewriting references, definitions or separators", () => {
    const body = "本文[^Architecture]。同じ出典[^Architecture]。\r\n\r\n[^Architecture]:  [設計](https://example.com/design)\r\n    続き。\r\n\r\n    別段落と **強調**。\r\n\r\n後の段落。\r\n";
    const document = createBlockDocument(body);
    expect(writeBlockDocument(document)).toBe(body);
    const region = document.regions[1]!;
    const note = readFootnoteDefinition(region.source)!;
    expect(note).toMatchObject({ identifier: "architecture", label: "Architecture", newline: "\r\n" });
    expect(note.content).toBe(" [設計](https://example.com/design)\n続き。\n\n別段落と **強調**。");
    expect(updateFootnoteContent(region.source, note.content)).toBe(region.source);
    const updated = writeBlockDocument(updateRegion(document, region.id, updateFootnoteContent(region.source, note.content.replace("続き。", "確認した続き。"))));
    expect(updated).toBe(body.replace("続き。", "確認した続き。"));
    expect(blockTree(updated).children?.filter((node) => node.type === "footnoteDefinition")).toHaveLength(1);
    expect(updated.match(/\[\^Architecture\]/gu)).toHaveLength(3);
  });

  it("keeps the marker and multiline Markdown semantics when editing note content", () => {
    const source = "[^出典]: 説明。";
    const content = "[公式資料](https://example.com/)\n\n次の段落。\n\n```text\ncode()\n```";
    const edited = updateFootnoteContent(source, content);
    expect(edited).toBe("[^出典]: [公式資料](https://example.com/)\n\n    次の段落。\n\n    ```text\n    code()\n    ```");
    expect(readFootnoteDefinition(edited)?.content).toBe(content);
    expect(blockTree(edited).children?.[0]?.children?.map((node) => node.type)).toEqual(["paragraph", "paragraph", "code"]);
    expect(blockTree(edited).children?.[0]?.children?.[2]?.value).toBe("code()");
    expect(readFootnoteDefinition(updateFootnoteContent(source, ""))).not.toBeNull();
  });

  it("preserves extra leading indentation when editing a note", () => {
    const source = "[^code]:     before()";
    const note = readFootnoteDefinition(source)!;
    const edited = updateFootnoteContent(source, note.content.replace("before", "after"));
    expect(edited).toBe("[^code]:     after()");
    expect(blockTree(edited).children?.[0]?.children?.map((node) => node.type)).toEqual(blockTree(source).children?.[0]?.children?.map((node) => node.type));
  });

  it("uses a free identifier for insertion and duplication, including unresolved references", () => {
    const body = "本文[^note-1]。\n\n[^NOTE-2]: 既存。\n\n[^note-4]: 別の既存。";
    const added = newFootnoteSource(body);
    expect(added.startsWith("[^note-3]: ")).toBe(true);
    const duplicated = newFootnoteSource(body + "\n\n" + added, "既存。\n\n補足。");
    expect(duplicated).toBe("[^note-5]: 既存。\n\n    補足。");
    expect(body).toContain("本文[^note-1]。");
  });

  it("inserts a matching reference and definition without changing existing regions", () => {
    const original = createBlockDocument("前。\n\n後。\n");
    const inserted = insertFootnote(original, 0);
    expect(writeBlockDocument(inserted.document)).toBe("前。\n\n[^note-1]\n\n[^note-1]: 脚注の内容を入力してください。\n\n後。\n");
    expect(readFootnoteDefinition(inserted.document.regions[inserted.index]!.source)?.identifier).toBe("note-1");
    const duplicate = insertFootnote(inserted.document, inserted.index, "脚注の内容を入力してください。");
    expect(writeBlockDocument(duplicate.document).match(/\[\^note-2\]/gu)).toHaveLength(2);
    expect(writeBlockDocument(original)).toBe("前。\n\n後。\n");
  });

  it("does not reinterpret ordinary MDX, multiple definitions or incomplete markers as one note", () => {
    for (const source of ["本文[^note]。", "[^note", "[^one]: A\n\n[^two]: B", "<Callout>\n\n[^note]: A\n\n</Callout>"])
      expect(readFootnoteDefinition(source)).toBeNull();
    expect(() => updateFootnoteContent("本文。", "変更")).toThrow("FOOTNOTE_SOURCE_UNSUPPORTED");
  });
});
