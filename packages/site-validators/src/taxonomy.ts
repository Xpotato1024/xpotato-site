import { taxonomyRegistrySchema, type TaxonomyRegistry } from "@xpotato/content-contracts";

export const parseTaxonomyRegistry = (input: unknown): TaxonomyRegistry => {
  const registry = taxonomyRegistrySchema.parse(input);
  const allRecords = [...registry.blogCategories, ...registry.noteSubjects, ...registry.toolCategories, ...registry.tags];
  const ids = allRecords.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error("Taxonomy IDs must be globally unique");
  return registry;
};

export const requireTaxonomyId = (registry: TaxonomyRegistry, kind: "blog" | "note" | "tool" | "tag", id: string): void => {
  const records = kind === "blog" ? registry.blogCategories : kind === "note" ? registry.noteSubjects : kind === "tool" ? registry.toolCategories : registry.tags;
  if (!records.some((record) => record.id === id && record.status === "active")) {
    throw new Error(`Unknown taxonomy term requires an explicit proposal: ${kind}:${id}`);
  }
};
