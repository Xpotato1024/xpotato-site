import { checkPhase5TaxonomyReview } from "./phase5-taxonomy-review.js";

const checkMode = process.argv.includes("--check");
if (!checkMode || process.argv.includes("--write")) throw new Error("Use --check");

const review = await checkPhase5TaxonomyReview();
const dispositionCounts = review.decisions.reduce<Record<string, number>>((counts, decision) => {
  counts[decision.disposition] = (counts[decision.disposition] ?? 0) + 1;
  return counts;
}, {});
const archiveCount = review.canonicalTags.filter((tag) => tag.archive).length;
const technologyCount = review.canonicalTags.filter((tag) => tag.kind === "technology").length;

console.log(
  `Phase 5 taxonomy review PASS: decisions=${review.decisions.length}; tags=${review.canonicalTags.length}; archive=${archiveCount}; technology=${technologyCount}; dispositions=${JSON.stringify(dispositionCounts)}; review=${review.reviewPayloadSha256}`,
);
