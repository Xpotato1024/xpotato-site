import { describe, expect, it } from "vitest";
import {
  blogFrontmatterSchema,
  noteFrontmatterSchema,
  projectFrontmatterSchema,
  toolFrontmatterSchema,
  pageFrontmatterSchema,
  galleryModulePropsSchema,
} from "@xpotato/content-contracts/content";
import {
  collectionFromPath,
  createDraftForCollection,
  draftPath,
  inferDraftCollection,
  parseDraft,
  updateDraft,
  validateDraft,
} from "./draft.js";

describe("portable draft creation across content kinds", () => {
  const schemas = {
    blog: blogFrontmatterSchema,
    notes: noteFrontmatterSchema,
    projects: projectFrontmatterSchema,
    tools: toolFrontmatterSchema,
    pages: pageFrontmatterSchema,
  };
  for (const collection of ["blog", "notes", "projects", "tools", "pages"] as const) {
    it(`${collection} saves an incomplete draft without inventing a publication date`, () => {
      const source = createDraftForCollection({ collection });
      const parsed = parseDraft(source);
      expect(parsed.data.draft).toBe(true);
      expect(parsed.data.pubDate).toBeUndefined();
      expect(parsed.data.description).toBe("");
      expect(validateDraft(source, collection)).toEqual([]);
      expect(collectionFromPath(draftPath(parsed.data.id, collection))).toBe(collection);
      expect(schemas[collection].safeParse({ ...parsed.data, draft: false }).success).toBe(false);
      if (collection === "pages") {
        expect(parsed.data.category).toBeUndefined();
        expect(parsed.data.tags).toBeUndefined();
      }
    });
  }
  it("keeps education metadata portable in articles and notes while published requirements stay strict", () => {
    for (const collection of ["blog", "notes"] as const) {
      const source = createDraftForCollection({ collection, education: true });
      expect(validateDraft(source, collection)).toEqual([]);
      const ready = updateDraft(source, {
        description: "学習内容",
        pubDate: "2026-01-01",
        draft: false,
        education: { subject: "制御工学", audience: "初学者", goals: ["モデルを読める"] },
      });
      expect(validateDraft(ready, collection)).toEqual([]);
      const incomplete = updateDraft(ready, { education: { subject: "" } });
      expect(validateDraft(incomplete, collection).length).toBeGreaterThan(0);
    }
  });
  it("does not guess whether a category-based MDX file is an article or a tool", () => {
    expect(
      inferDraftCollection(parseDraft(createDraftForCollection({ collection: "blog" })).data),
    ).toBeNull();
    expect(
      inferDraftCollection(parseDraft(createDraftForCollection({ collection: "tools" })).data),
    ).toBeNull();
    for (const collection of ["notes", "projects", "pages"] as const)
      expect(inferDraftCollection(parseDraft(createDraftForCollection({ collection })).data)).toBe(
        collection,
      );
  });
  it("accepts literal portable Gallery controls and rejects out-of-range layout values", () => {
    expect(
      galleryModulePropsSchema.parse({
        columns: "3",
        mobileColumns: "1",
        tabletColumns: "2",
        gap: "small",
        fit: "contain",
      }),
    ).toMatchObject({ columns: "3" });
    expect(galleryModulePropsSchema.safeParse({ columns: "5" }).success).toBe(false);
    const source = createDraftForCollection({ collection: "notes" });
    expect(
      validateDraft(
        updateDraft(
          source,
          {},
          '<Gallery columns="3" mobileColumns="1"><Figure asset="sample" alt="作例" /></Gallery>',
        ),
        "notes",
      ),
    ).toEqual([]);
  });
});
