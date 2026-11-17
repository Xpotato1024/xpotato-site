import { checkSiteOutput } from "../../packages/site-validators/src/delivery/site-output.js";
console.log("Current site output PASS", JSON.stringify(await checkSiteOutput()));
