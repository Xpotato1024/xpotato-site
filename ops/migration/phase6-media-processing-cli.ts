import { checkPhase6MediaLocalProcessing, writePhase6MediaLocalProcessing } from "./phase6-media-processing.js";

const mode = process.argv[2] ?? "--check";
if (!new Set(["--write", "--check"]).has(mode)) throw new Error(`Unknown Phase 6 processing mode: ${mode}`);

const manifest = mode === "--write"
  ? await writePhase6MediaLocalProcessing()
  : await checkPhase6MediaLocalProcessing();

console.log(
  `Phase 6 local media processing PASS: semantic=${manifest.semanticAssetCount}; processed=${manifest.processedAssetCount}; deferred=${manifest.deferredAssetCount}; toolchain=${manifest.toolchainSha256}; manifest=${manifest.manifestPayloadSha256}`,
);
