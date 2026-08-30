import {
  checkPhase4Materialization,
  writePhase4Materialization,
} from "./phase4-content-materialization.js";

const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check");
const evidenceMode = process.argv.includes("--check-evidence");
if ([writeMode, checkMode, evidenceMode].filter(Boolean).length !== 1) throw new Error("Use exactly one of --write, --check, or --check-evidence");

const manifest = writeMode
  ? await writePhase4Materialization()
  : await checkPhase4Materialization({ activeFiles: !evidenceMode });

const conversionCounts = manifest.records.reduce<Record<string, number>>((counts, record) => {
  counts[record.bodyConversion] = (counts[record.bodyConversion] ?? 0) + 1;
  return counts;
}, {});
const remainingCounts = manifest.records.flatMap((record) => record.remainingPhases).reduce<Record<string, number>>((counts, phase) => {
  counts[phase] = (counts[phase] ?? 0) + 1;
  return counts;
}, {});

console.log(
  `Phase 4 content materialization ${evidenceMode ? "EVIDENCE " : ""}PASS: ${manifest.records.length} records; conversions=${JSON.stringify(conversionCounts)}; remaining=${JSON.stringify(remainingCounts)}; manifest=${manifest.manifestPayloadSha256}`,
);
