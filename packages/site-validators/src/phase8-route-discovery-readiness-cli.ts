import { checkPhase8Readiness, writePhase8Readiness } from "./phase8-route-discovery-readiness.js";
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if (write === check) throw new Error("Use exactly one of --write or --check");
const manifest = await (write ? writePhase8Readiness() : checkPhase8Readiness());
console.log(`Phase 8 exact evidence PASS: ${manifest.manifestPayloadSha256}`);
console.log(JSON.stringify({ legacy: manifest.legacyPublicRouteCount, dispositions: manifest.dispositionCounts, canonicalContent: manifest.canonicalContentRoutes.count, sitemap: manifest.sitemap.count }));
