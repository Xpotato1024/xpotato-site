import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeProductionDist } from "./vnext-artifact-canonicalization.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidence = await canonicalizeProductionDist(root);
console.log("vNext canonicalization PASS " + JSON.stringify(evidence));
