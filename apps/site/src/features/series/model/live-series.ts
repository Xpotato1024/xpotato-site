import { derivePublicSeries } from "@xpotato/portable-content/series";
import { seriesRegistry } from "../../../../../../content/registry/series/index.js";
import { getLiveContentCatalog } from "../../discovery/model/live-catalog.js";

export const getPublicSeries = async () => {
  if (seriesRegistry.series.length === 0) {
    return [];
  }
  return derivePublicSeries(seriesRegistry, await getLiveContentCatalog());
};
