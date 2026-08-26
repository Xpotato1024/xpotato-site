import { contentMediaRegistrySchema } from "@xpotato/content-contracts";

export const fixtureMediaRegistry = contentMediaRegistrySchema.parse({
  schemaVersion: 1,
  contentId: "38f4cc36-81fb-4d7c-8063-686eb8000352",
  assets: [],
});

export const mediaRegistries = Object.freeze([fixtureMediaRegistry]);
