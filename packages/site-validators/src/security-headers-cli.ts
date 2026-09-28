import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeBuiltHtml,
  readBuiltHtml,
  readBuiltSecurityAssets,
  renderSecurityHeaderArtifact,
  validateBuiltHtmlAgainstSecurityHeaders,
} from "./security-headers.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dist = join(root, "apps/site/dist");
const distHeaders = join(dist, "_headers");
const builtHtml = await readBuiltHtml(dist);
const builtAssets = await readBuiltSecurityAssets(dist);
const analysis = analyzeBuiltHtml(builtHtml);
const expected = renderSecurityHeaderArtifact(analysis);
if (process.argv.includes("--write")) {
  const errors = validateBuiltHtmlAgainstSecurityHeaders(expected, builtHtml, builtAssets);
  if (errors.length > 0) throw new Error(`Built output security policy failed before header generation:\n${errors.join("\n")}`);
  await writeFile(distHeaders, expected, "utf8");
  console.log("Security headers generated once in the built static output");
} else if (process.argv.includes("--check")) {
  const builtArtifact = await readFile(distHeaders, "utf8").catch(() => "");
  const errors = builtArtifact === "" ? ["apps/site/dist/_headers is missing"] : [];
  errors.push(...validateBuiltHtmlAgainstSecurityHeaders(builtArtifact, builtHtml, builtAssets));
  if (errors.length > 0) throw new Error(`Security header validation failed:\n${errors.join("\n")}`);
  console.log(`Security/CSP validation PASS (${analysis.scriptHashes.length} executable hashes, ${analysis.styleHashes.length} style hashes)`);
} else {
  throw new Error("Expected --write or --check");
}
