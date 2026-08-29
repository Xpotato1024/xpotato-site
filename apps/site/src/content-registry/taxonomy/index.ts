import { taxonomyRegistrySchema } from "@xpotato/content-contracts";
import { phase5TaxonomyRegistryData } from "./phase5-generated.js";

export const taxonomyRegistry = taxonomyRegistrySchema.parse(phase5TaxonomyRegistryData);
