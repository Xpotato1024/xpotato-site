import assert from "node:assert/strict";
import type { ContentCollection } from "@xpotato/content-contracts";
import type { DerivedCatalogEntry } from "../../../apps/site/src/lib/catalog.js";

export interface MigrationIdentity {
  readonly legacyContentId: string;
  readonly vNextContentId: string;
  readonly collection: ContentCollection;
  readonly targetPath: string;
}

/** The frozen migration universe is not the current publication universe. */
export const selectMigrationCohort = (
  catalog: readonly DerivedCatalogEntry[],
  materialized: readonly MigrationIdentity[],
  identities: readonly MigrationIdentity[],
): readonly DerivedCatalogEntry[] => {
  const key = (record: MigrationIdentity) => JSON.stringify([
    record.legacyContentId, record.vNextContentId, record.collection, record.targetPath,
  ]);
  assert.equal(materialized.length, 53, "Frozen migration must retain 53 identities");
  assert.equal(materialized.filter((record) => record.collection === "blog").length, 44, "Frozen migration must retain 44 Blog identities");
  assert.deepEqual(materialized.map(key).sort(), identities.map(key).sort(), "Migration materialization/identity cohort mismatch");
  for (const field of ["legacyContentId", "vNextContentId"] as const) {
    assert.equal(new Set(materialized.map((record) => record[field])).size, materialized.length, "Duplicate migration " + field);
  }
  assert.equal(new Set(catalog.map((entry) => entry.routeRecord.contentId)).size, catalog.length, "Duplicate catalog ContentId");
  const byId = new Map(catalog.map((entry) => [entry.routeRecord.contentId, entry]));
  return materialized.map((record) => {
    const entry = byId.get(record.vNextContentId);
    assert.ok(entry, "Lost materialized content " + record.legacyContentId);
    assert.equal(entry.routeRecord.collection, record.collection, "Migration collection changed");
    if (record.collection === "blog") {
      assert.equal(entry.disposition, "held_candidate", "Normal publication cannot lift migrated Blog hold");
      assert.equal(entry.source.data.draft, true, "Migrated Blog must remain draft");
    }
    return entry;
  });
};

/** Offline migration projection only; never writes draft source or changes public selection. */
export const projectMigrationDiscovery = (cohort: readonly DerivedCatalogEntry[]) =>
  cohort.map((entry) => ({
    ...entry.discoveryRecord,
    webIndexable: entry.source.data.seo?.noindex !== true,
    siteSearchEligible: entry.source.data.seo?.noindex !== true,
  }));
