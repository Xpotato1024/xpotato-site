import type { DerivedCatalogEntry } from "./catalog.js";
export const publicationHoldsPath: "content/registry/publication-holds.json";
export function readPublicationHoldIds(value: unknown): string[];
export function assertPublicationHolds(
  catalog: readonly DerivedCatalogEntry[],
  ids: readonly string[],
): void;
