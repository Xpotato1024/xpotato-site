import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { validateWorkspaceDependencies } from "./dependencies.js";
import { validateGitMediaAddition } from "./git-media.js";
import { validatePortableMdx } from "./portable-mdx.js";

const root = resolve(process.cwd());
const required = [
  "apps/site",
  "packages/content-contracts",
  "packages/article-pipeline",
  "packages/media-ingest",
  "packages/example-verifier",
  "packages/site-validators",
  "schemas/generated",
  "tests/fixtures",
];
const errors: string[] = [];

for (const path of required) {
  await readdir(join(root, path)).catch(() => errors.push(`Required workspace path missing: ${path}`));
}

for (const path of ["apps/site", "packages/content-contracts", "packages/article-pipeline", "packages/media-ingest", "packages/example-verifier", "packages/site-validators"]) {
  const manifest = JSON.parse(await readFile(join(root, path, "package.json"), "utf8")) as Parameters<typeof validateWorkspaceDependencies>[0];
  errors.push(...validateWorkspaceDependencies(manifest));
}

const walk = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
};

for (const file of await walk(join(root, "apps/site/src/content"))) {
  if (!/\.mdx?$/iu.test(file)) continue;
  for (const problem of validatePortableMdx(await readFile(file, "utf8"))) {
    errors.push(`${relative(root, file)}: ${problem}`);
  }
}

for (const file of await walk(join(root, "apps/site"))) {
  const repositoryPath = relative(root, file).replaceAll("\\", "/");
  const decision = validateGitMediaAddition(repositoryPath);
  if (!decision.allowed) errors.push(`${repositoryPath}: ${decision.reason}`);
}

if (errors.length > 0) throw new Error(`Repository validation failed:\n${errors.join("\n")}`);
console.log("Repository validation PASS");
