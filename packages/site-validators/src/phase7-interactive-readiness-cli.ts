import { checkPhase7InteractiveReadiness, writePhase7InteractiveReadiness } from "./phase7-interactive-readiness.js";

const mode = process.argv[2] ?? "--check";
if (!new Set(["--write", "--check"]).has(mode)) throw new Error(`Unknown Phase 7 readiness mode: ${mode}`);

const manifest = mode === "--write"
  ? await writePhase7InteractiveReadiness()
  : await checkPhase7InteractiveReadiness();

console.log(
  `Phase 7 interactive readiness PASS: cases=${manifest.observableBehavior.cases.length}; isolatedRoutes=${manifest.runtimeIsolation.contentOnlyRoutes.length}; routeJs=${manifest.runtimeIsolation.routeClientJsRawBytes}B/${manifest.runtimeIsolation.routeClientJsGzipBytes}B-gzip; manifest=${manifest.manifestPayloadSha256}`,
);
