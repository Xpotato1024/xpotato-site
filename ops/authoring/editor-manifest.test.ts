import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDraftForCollection, parseDraft, updateDraft } from "@xpotato/editor-core/draft";
import { editorContentIndex, generateEditorManifest } from "./editor-manifest.js";

describe("public editor contract and authenticated article index", () => {
  it("keeps held article titles and identities out of the bundled manifest and catches manual title changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "editor-manifest-"));
    try {
      for (const directory of [
        "articles",
        "notes",
        "projects",
        "tools",
        "pages",
        "registry/taxonomy",
      ])
        await mkdir(join(root, "content", directory), { recursive: true });
      await writeFile(
        join(root, "content/registry/taxonomy/terms.json"),
        JSON.stringify({
          schemaVersion: 1,
          blogCategories: [],
          noteSubjects: [],
          toolCategories: [],
          tags: [],
        }),
      );
      const source = createDraftForCollection({
        collection: "notes",
        title: "PRIVATE_DRAFT_TITLE_9172",
      });
      const file = join(root, "content/notes/example.mdx");
      await writeFile(file, source);
      await generateEditorManifest(false, root);
      const publicManifest = await readFile(join(root, "content/registry/editor.json"), "utf8");
      expect(publicManifest).not.toContain("PRIVATE_DRAFT_TITLE_9172");
      expect(publicManifest).not.toContain(parseDraft(source).data.id);
      expect(JSON.parse(publicManifest).seriesRegistry).toBeUndefined();
      const privateIndex = JSON.parse(
        await readFile(join(root, "content/registry/editor-content-index.json"), "utf8"),
      );
      expect(privateIndex.documents).toEqual([
        {
          contentId: parseDraft(source).data.id,
          path: "content/notes/example.mdx",
          title: "PRIVATE_DRAFT_TITLE_9172",
          collection: "notes",
          draft: true,
          education: false,
        },
      ]);
      await expect(generateEditorManifest(true, root)).resolves.toBeUndefined();
      await writeFile(file, updateDraft(source, { draft: false }));
      expect((await editorContentIndex(root)).documents[0]!.draft).toBe(false);
      await writeFile(
        file,
        createDraftForCollection({
          collection: "notes",
          education: true,
          id: parseDraft(source).data.id,
        }),
      );
      expect((await editorContentIndex(root)).documents[0]).toMatchObject({
        collection: "notes",
        education: true,
        draft: true,
      });
      await writeFile(file, updateDraft(source, { title: "Changed title" }));
      await expect(generateEditorManifest(true, root)).rejects.toThrow("EDITOR_MANIFEST_STALE");
      await generateEditorManifest(false, root);
      expect((await editorContentIndex(root)).documents[0]!.title).toBe("Changed title");
      await expect(generateEditorManifest(true, root)).resolves.toBeUndefined();
      await writeFile(join(root, "content/notes/copy.mdx"), source);
      await expect(editorContentIndex(root)).rejects.toThrow("EDITOR_CONTENT_INDEX_DUPLICATE");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
