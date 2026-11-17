import { taxonomyRegistrySchema } from "@xpotato/content-contracts";
import terms from "./terms.json" with { type: "json" };

/** The current taxonomy is editorial data; migration generators do not own it. */
export const taxonomyRegistry = taxonomyRegistrySchema.parse(terms);
