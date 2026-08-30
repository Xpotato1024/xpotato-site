import {
  checkPhase6MediaReviewProposal,
  writePhase6MediaReviewProposal,
} from "./phase6-media-review.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");

const proposal = writeMode
  ? await writePhase6MediaReviewProposal()
  : await checkPhase6MediaReviewProposal();

const dispositionCounts = proposal.decisions.reduce<Record<string, number>>((counts, decision) => {
  counts[decision.disposition] = (counts[decision.disposition] ?? 0) + 1;
  return counts;
}, {});
const deterministicHeroes = proposal.blogPublicationPlans.filter((plan) => plan.hero.origin === "deterministic_cover").length;
console.log(
  `Phase 6 media review proposal PASS: decisions=${proposal.decisions.length}; blogs=${proposal.blogPublicationPlans.length}; deterministicHeroes=${deterministicHeroes}; dispositions=${JSON.stringify(dispositionCounts)}; review=${proposal.reviewPayloadSha256}`,
);
