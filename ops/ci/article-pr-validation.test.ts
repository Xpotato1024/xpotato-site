import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { draftPath, updateDraft, validateDraft } from "@xpotato/editor-core/draft";
import { editorContentIndex, generateEditorManifest } from "../authoring/editor-manifest.js";
import {
  articlePrFixture,
  assertDraftAbsentFromPublicOutput,
  assertFixtureIsUnpublished,
  writeCmsArticleFixture,
} from "./article-pr-fixture.js";

describe("ordinary CMS drafts in the article validation lane", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "article-pr-validation-"));
    for (const directory of [
      "articles",
      "notes",
      "projects",
      "tools",
      "pages",
      "registry/taxonomy",
    ]) {
      await mkdir(join(root, "content", directory), { recursive: true });
    }
    await writeFile(
      join(root, "content/registry/taxonomy/terms.json"),
      await readFile(new URL("../../content/registry/taxonomy/terms.json", import.meta.url)),
    );
    await generateEditorManifest(false, root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("keeps CMS create and title/body revision compatible with the real manifest and public catalog", async () => {
    const path = await writeCmsArticleFixture(root, "create");
    expect(path).toBe(draftPath(articlePrFixture.contentId));
    await generateEditorManifest(true, root);
    await assertFixtureIsUnpublished(root);
    await writeCmsArticleFixture(root, "revise");
    await generateEditorManifest(true, root);
    await assertFixtureIsUnpublished(root);
    expect((await editorContentIndex(root)).documents).toEqual([
      {
        contentId: articlePrFixture.contentId,
        path,
        title: articlePrFixture.revisedTitle,
        collection: "blog",
        draft: true,
        education: false,
      },
    ]);
  });

  it("the existing manifest validator rejects a stale CMS index before a site build", async () => {
    await writeCmsArticleFixture(root, "create");
    const indexPath = join(root, "content/registry/editor-content-index.json");
    const initialIndex = await readFile(indexPath, "utf8");
    await writeCmsArticleFixture(root, "revise");
    await writeFile(indexPath, initialIndex);
    await expect(generateEditorManifest(true, root)).rejects.toThrow("EDITOR_MANIFEST_STALE");
  });

  it("the fixture cannot overwrite an existing draft identity or publish it silently", async () => {
    const path = await writeCmsArticleFixture(root, "create");
    await expect(writeCmsArticleFixture(root, "create")).rejects.toThrow(
      "Fixture identity must be new",
    );
    const publishedSource = updateDraft(await readFile(join(root, path), "utf8"), {
      draft: false,
      description: "公開状態の切替を検出する一時fixtureです。",
      pubDate: "2026-11-21",
    });
    expect(validateDraft(publishedSource, "blog")).toEqual([]);
    await writeFile(join(root, path), publishedSource);
    await expect(writeCmsArticleFixture(root, "revise")).rejects.toThrow(
      "Fixture must remain a draft",
    );
    await expect(assertFixtureIsUnpublished(root)).rejects.toThrow();
  });

  it.each(["article/index.html", "search/search-index.json", "_astro/editor.js", "rss.xml"])(
    "rejects synthetic draft data leaked into %s",
    async (file) => {
      const dist = join(root, "dist");
      const target = join(dist, file);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, "public output");
      await expect(assertDraftAbsentFromPublicOutput(dist)).resolves.toBe(1);
      for (const marker of Object.values(articlePrFixture)) {
        await writeFile(target, "public output " + marker);
        await expect(assertDraftAbsentFromPublicOutput(dist)).rejects.toThrow(
          "Synthetic draft leaked",
        );
      }
    },
  );
});
