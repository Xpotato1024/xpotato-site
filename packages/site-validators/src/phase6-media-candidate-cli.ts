import {
  checkPhase6MediaRepositoryCandidate,
  writePhase6MediaRepositoryCandidate,
} from "./phase6-media-candidate.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
const emitSources = process.argv.includes("--emit-sources");
if (writeMode === checkMode) throw new Error("Use exactly one of --write or --check");
if (emitSources && !writeMode) throw new Error("--emit-sources requires --write");

const manifest = writeMode
  ? await writePhase6MediaRepositoryCandidate(emitSources)
  : await checkPhase6MediaRepositoryCandidate();

const blocked = manifest.processingPlan.filter((record) => record.blockers.length > 0);
const blockers = blocked.flatMap((record) => record.blockers).reduce<Record<string, number>>((counts, blocker) => {
  counts[blocker] = (counts[blocker] ?? 0) + 1;
  return counts;
}, {});
console.log(
  `Phase 6 repository media candidate PASS: semantic=${manifest.processingPlan.length}; deterministic=${manifest.deterministicSources.length}; blocked=${blocked.length}; blockers=${JSON.stringify(blockers)}; manifest=${manifest.manifestPayloadSha256}`,
);
