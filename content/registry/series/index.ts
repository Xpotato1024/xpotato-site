import { seriesRegistrySchema } from "@xpotato/content-contracts/series";
import registry from "./series.json" with { type: "json" };

export const seriesRegistry = seriesRegistrySchema.parse(registry);
