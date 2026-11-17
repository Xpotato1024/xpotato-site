import { discoveryProfile } from "../../../../../../content/registry/discovery.js";
import type { ContentDiscoveryRecord, TaxonomyRegistry } from "@xpotato/content-contracts";
import * as shared from "@xpotato/portable-content/discovery";
export * from "@xpotato/portable-content/discovery";
// The site selects its profile; algorithms do not import a site's files or defaults.
export const generateArchivePages = (
  records: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
) => shared.generateArchivePages(records, taxonomy, discoveryProfile);
export const relatedScore = (
  source: ContentDiscoveryRecord,
  candidate: ContentDiscoveryRecord,
  taxonomy: TaxonomyRegistry,
) => shared.relatedScore(source, candidate, taxonomy, discoveryProfile);
export const selectRelated = (
  source: ContentDiscoveryRecord,
  candidates: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
) => shared.selectRelated(source, candidates, taxonomy, discoveryProfile);
export const selectToolArticles = (
  source: ContentDiscoveryRecord,
  candidates: readonly ContentDiscoveryRecord[],
  taxonomy: TaxonomyRegistry,
) => shared.selectToolArticles(source, candidates, taxonomy, discoveryProfile);
