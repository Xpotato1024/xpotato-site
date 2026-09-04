import type { ContentCollection, InteractiveModuleRecord } from "@xpotato/content-contracts";

export const requireActiveInteractiveModule = (
  registry: Readonly<Record<string, InteractiveModuleRecord>>,
  moduleId: string,
  collection: ContentCollection,
): InteractiveModuleRecord => {
  const record = registry[moduleId];
  if (!record || record.status !== "active") throw new Error(`Unknown interactive module: ${moduleId}`);
  if (!record.allowedCollections.includes(collection)) {
    throw new Error(`Interactive module ${moduleId} is not allowed in ${collection}`);
  }
  return record;
};
