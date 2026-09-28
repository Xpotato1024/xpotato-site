import { checkPhase8Capture, checkPhase8HeldPreview, checkPhase8Readiness, writePhase8Readiness } from "./phase8-route-discovery-readiness.js";

const modes = ["--capture-write", "--check", "--capture-check", "--held-preview-check"] as const;
const selected = modes.filter((mode) => process.argv.includes(mode));
if (selected.length !== 1) throw new Error(`Use exactly one of ${modes.join(", ")}`);
const mode = selected[0]!;

if (mode === "--held-preview-check") {
  const heldPreview = await checkPhase8HeldPreview();
  console.log(`Phase 8 held-Blog private preview PASS: ${heldPreview.count} routes`);
} else {
  const manifest = mode === "--capture-write"
    ? await writePhase8Readiness()
    : mode === "--capture-check"
      ? await checkPhase8Capture()
      : await checkPhase8Readiness();
  const label = mode === "--check" ? "build-consumer validation" : "exact evidence capture";
  console.log(`Phase 8 ${label} PASS`);
  console.log(JSON.stringify({ legacy: manifest.legacyPublicRouteCount, dispositions: manifest.dispositionCounts, canonicalContent: manifest.canonicalContentRoutes.count, sitemap: manifest.sitemap.count }));
}
