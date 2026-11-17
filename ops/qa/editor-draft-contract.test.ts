import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSiteContent } from "../../packages/site-validators/src/site-content.js";
import {
  selectPublishedCatalog,
  selectSearchEligibleCatalog,
  selectFeedEligibleCatalog,
} from "@xpotato/portable-content/catalog";
import { createDraft, updateDraft, draftPath } from "@xpotato/editor-core/draft";
it("the normal site reader accepts an undated public-Git draft with staged media and excludes every publication surface", async () => {
  const root = await mkdtemp(join(tmpdir(), "cms-draft-contract-"));
  try {
    for (const collection of ["articles", "notes", "projects", "tools", "pages"])
      await mkdir(join(root, "content", collection), { recursive: true });
    const id = "11111111-1111-4111-8111-111111111111";
    const source = updateDraft(
      createDraft("公開前の編集", "software", id),
      {},
      '本文。\n\n<Figure asset="staged-photo" alt="未承認の写真" />\n',
    );
    await writeFile(join(root, draftPath(id)), source);
    const result = await readSiteContent(root);
    expect(result.catalog).toHaveLength(1);
    expect(result.catalog[0]!.source.data.description).toBe("");
    expect(result.catalog[0]!.discoveryRecord.description).toBe("公開前の編集");
    expect(result.catalog[0]!.disposition).toBe("held_candidate");
    expect(result.catalog[0]!.discoveryRecord.webIndexable).toBe(false);
    expect(result.catalog[0]!.discoveryRecord.siteSearchEligible).toBe(false);
    expect(selectPublishedCatalog(result.catalog)).toEqual([]);
    expect(selectSearchEligibleCatalog(result.catalog)).toEqual([]);
    expect(selectFeedEligibleCatalog(result.catalog)).toEqual([]);
    await writeFile(join(root, draftPath(id)), source.replace("draft: true", "draft: false"));
    await expect(readSiteContent(root)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
