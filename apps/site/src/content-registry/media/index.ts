import articleMedia_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8 from "./blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json";
import { contentMediaRegistrySchema } from "@xpotato/content-contracts";

export const fixtureMediaRegistry = contentMediaRegistrySchema.parse({
  schemaVersion: 1,
  contentId: "38f4cc36-81fb-4d7c-8063-686eb8000352",
  assets: [],
});

export const mediaRegistries = Object.freeze([contentMediaRegistrySchema.parse(articleMedia_e7562440_e0bf_42a9_8a90_d66f4e1a4eb8),fixtureMediaRegistry]);
