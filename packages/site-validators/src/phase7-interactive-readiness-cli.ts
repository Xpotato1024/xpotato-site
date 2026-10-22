import {readRegisteredToolRoutes} from "./tool-runtime-policy.js";
import {checkPinnedPrimeReadiness} from "./prime-tool-readiness.js";
import {fileURLToPath} from "node:url";
const registered=await readRegisteredToolRoutes();
if(registered.some(t=>t.asyncCompute)){
 if((process.argv[2]??"--check")!=="--check")throw Error("Legacy evidence may not be rewritten for the replacement Tool");
 console.log("Pinned prime release readiness PASS",JSON.stringify(await checkPinnedPrimeReadiness(fileURLToPath(new URL("../../../",import.meta.url)))));
}else{
const {checkPhase7InteractiveReadiness,writePhase7InteractiveReadiness}=await import("./phase7-interactive-readiness.js");

const mode = process.argv[2] ?? "--check";
if (!new Set(["--write", "--check"]).has(mode)) throw new Error(`Unknown Phase 7 readiness mode: ${mode}`);

const manifest = mode === "--write"
  ? await writePhase7InteractiveReadiness()
  : await checkPhase7InteractiveReadiness();

console.log(
  `Phase 7 interactive readiness PASS: cases=${manifest.observableBehavior.cases.length}; isolatedRoutes=${manifest.runtimeIsolation.contentOnlyRoutes.length}; routeJs=${manifest.runtimeIsolation.routeClientJsRawBytes}B/${manifest.runtimeIsolation.routeClientJsGzipBytes}B-gzip; manifest=${manifest.manifestPayloadSha256}`,
);

}
