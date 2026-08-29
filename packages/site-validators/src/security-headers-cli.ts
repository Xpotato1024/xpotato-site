import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeBuiltHtml,
  readBuiltHtml,
  renderSecurityHeaderArtifact,
  validateBuiltHtmlAgainstSecurityHeaders,
} from "./security-headers.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dist = join(root, "apps/site/dist");
const publicHeaders = join(root, "apps/site/public/_headers");
const distHeaders = join(dist, "_headers");
const builtHtml = await readBuiltHtml(dist);
const analysis = analyzeBuiltHtml(builtHtml);
if (analysis.errors.length > 0) throw new Error(`Built HTML security analysis failed:\n${analysis.errors.join("\n")}`);
const expected = renderSecurityHeaderArtifact(analysis);
const normalizeLineEndings = (source: string): string => source.replaceAll("\r\n", "\n");

if (process.argv.includes("--write")) {
  await mkdir(dirname(publicHeaders), { recursive: true });
  await writeFile(publicHeaders, expected, "utf8");
  await writeFile(distHeaders, expected, "utf8");
  console.log("Security headers generated from the exact built executable/style set");
} else if (process.argv.includes("--check")) {
  const sourceArtifact = await readFile(publicHeaders, "utf8").catch(() => "");
  const builtArtifact = await readFile(distHeaders, "utf8").catch(() => "");
  const errors = [...validateBuiltHtmlAgainstSecurityHeaders(sourceArtifact, builtHtml)];
  if (normalizeLineEndings(sourceArtifact) !== expected) errors.push("apps/site/public/_headers is stale for the current production build");
  if (normalizeLineEndings(builtArtifact) !== expected) errors.push("apps/site/dist/_headers is stale for the current production build");
  if (errors.length > 0) throw new Error(`Security header validation failed:\n${errors.join("\n")}`);
  console.log(`Security/CSP validation PASS (${analysis.scriptHashes.length} executable hashes, ${analysis.styleHashes.length} style hashes)`);
} else {
  throw new Error("Expected --write or --check");
}
