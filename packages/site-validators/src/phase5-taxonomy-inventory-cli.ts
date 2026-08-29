import {
  checkPhase5TaxonomyRawInventory,
  writePhase5TaxonomyRawInventory,
} from "./phase5-taxonomy-inventory.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");

const inventory = writeMode
  ? await writePhase5TaxonomyRawInventory()
  : await checkPhase5TaxonomyRawInventory();

const namespaceCounts = inventory.terms.reduce<Record<string, number>>((counts, term) => {
  counts[term.namespace] = (counts[term.namespace] ?? 0) + 1;
  return counts;
}, {});

console.log(
  `Phase 5 raw taxonomy inventory PASS: pending=${inventory.taxonomyPendingContentCount}; occurrences=${inventory.rawTermOccurrenceCount}; unique=${inventory.uniqueRawTermCount}; namespaces=${JSON.stringify(namespaceCounts)}; manifest=${inventory.manifestPayloadSha256}`,
);
