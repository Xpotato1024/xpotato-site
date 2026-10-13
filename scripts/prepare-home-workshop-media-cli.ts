import { resolve } from "node:path";
import { prepareHomeWorkshop } from "./prepare-home-workshop-media.js";
// This command prepares a private review candidate; it does not connect ordinary builds or publish media.
process.chdir(resolve(import.meta.dirname, ".."));
const output = resolve(process.argv[2] ?? ".local/home-workshop-candidate");
const candidate = await prepareHomeWorkshop(output);
console.log(JSON.stringify({ state: candidate.state, candidateSha256: candidate.candidateSha256,
  deliveryObjects: candidate.localObjects.length, providerMutations: 0, productionBindingActive: false }));
