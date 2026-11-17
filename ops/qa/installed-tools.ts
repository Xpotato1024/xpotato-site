import { fileURLToPath } from "node:url";
import { checkInstalledToolsReadiness } from "../../packages/site-validators/src/browser-tools/installed-tools-readiness.js";
console.log(
  "Installed Tool readiness PASS",
  JSON.stringify(
    await checkInstalledToolsReadiness(fileURLToPath(new URL("../../", import.meta.url))),
  ),
);
