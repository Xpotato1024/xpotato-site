import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { generatedSchemaRegistry } from "../src/schema-registry.js";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(packageDirectory, "../../schemas/generated");
const checkOnly = process.argv.includes("--check");
const expectedNames = new Set(Object.keys(generatedSchemaRegistry).map((name) => `${name}.schema.json`));

const serialize = (schema: z.ZodType): string =>
  `${JSON.stringify(z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }), null, 2)}\n`;

const failures: string[] = [];
for (const [name, schema] of Object.entries(generatedSchemaRegistry)) {
  const path = resolve(outputDirectory, `${name}.schema.json`);
  const expected = serialize(schema);
  if (checkOnly) {
    const actual = await readFile(path, "utf8").catch(() => undefined);
    if (actual !== expected) failures.push(`${name}.schema.json is stale or missing`);
  } else {
    await writeFile(path, expected, "utf8");
  }
}

if (checkOnly) {
  const unexpected = (await readdir(outputDirectory)).filter((name) => name.endsWith(".schema.json") && !expectedNames.has(name));
  failures.push(...unexpected.map((name) => `${name} is not registered`));
  if (failures.length > 0) {
    throw new Error(`Generated schema freshness failed:\n${failures.join("\n")}`);
  }
}
