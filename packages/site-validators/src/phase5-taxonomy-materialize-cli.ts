import {
  checkPhase5TaxonomyMaterialization,
  writePhase5TaxonomyMaterialization,
} from "./phase5-taxonomy-materialization.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");

const manifest = writeMode
  ? await writePhase5TaxonomyMaterialization()
  : await checkPhase5TaxonomyMaterialization();

const taggedRecords = manifest.records.filter((record) => record.tagIds.length > 0).length;
const stackedProjects = manifest.records.filter((record) => record.stackIds.length > 0).length;
const retiredOccurrences = manifest.records.reduce((sum, record) => sum + record.retiredRawTerms.length, 0);

console.log(
  `Phase 5 taxonomy materialization PASS: records=${manifest.records.length}; tagged=${taggedRecords}; stacked=${stackedProjects}; retired=${retiredOccurrences}; registry=${manifest.taxonomyRegistryPayloadSha256}; manifest=${manifest.manifestPayloadSha256}`,
);
