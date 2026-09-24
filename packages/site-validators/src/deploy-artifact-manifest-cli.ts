import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestFromDist } from "./deploy-artifact-manifest.js";
import { verifyCanonicalFinalDist } from "./vnext-artifact-canonicalization.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
await verifyCanonicalFinalDist(root);
const manifest = await manifestFromDist(resolve(root, "apps/site/dist"));
const json = JSON.stringify(manifest, null, 2) + "\n";
const output = process.argv[2];
if (output !== undefined) {
  const allowedRoot = resolve(process.env.RUNNER_TEMP ?? tmpdir());
  const child = relative(allowedRoot, resolve(output));
  if (!isAbsolute(output) || child === "" || child === ".." || child.startsWith(".." + sep) || isAbsolute(child)) {
    throw new Error("Manifest output must be an absolute child of the temporary directory");
  }
  await writeFile(output, json, "utf8");
}
console.log("vNext deploy artifact manifest PASS " + JSON.stringify({
  fileCount: manifest.fileCount,
  outputTreeSha256: manifest.outputTreeSha256,
  output: output ?? null,
}));
