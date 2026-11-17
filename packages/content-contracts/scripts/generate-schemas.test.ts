import { generatedSchemaRegistry } from "../src/schema-registry.js";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { generateSchemas } from "./generate-schemas.js";
import { generatedSchemaPaths, generatedSchemaGroups } from "../src/schema-groups.js";

it("regenerates all grouped schemas from empty output without changing contract bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "schema-groups-"));
  try {
    await generateSchemas(root);
    await generateSchemas(root, true);
    expect([...generatedSchemaPaths().keys()].sort()).toEqual(
      Object.keys(generatedSchemaRegistry).sort(),
    );
    const before = new Map(
      await Promise.all(
        [...generatedSchemaPaths().values()].map(
          async (path) => [path, await readFile(join(root, path), "utf8")] as const,
        ),
      ),
    );
    await generateSchemas(root);
    await generateSchemas(root, true);
    for (const [path, source] of before)
      expect(await readFile(join(root, path), "utf8")).toBe(source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("rejects stale, missing and unregistered nested artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "schema-freshness-"));
  try {
    await generateSchemas(root);
    const path = join(root, [...generatedSchemaPaths().values()][0]!);
    await writeFile(path, "{}");
    await expect(generateSchemas(root, true)).rejects.toThrow("stale or missing");
    await generateSchemas(root);
    await rm(path);
    await expect(generateSchemas(root, true)).rejects.toThrow("stale or missing");
    await generateSchemas(root);
    await mkdir(join(root, "unexpected"));
    await writeFile(join(root, "unexpected/extra.txt"), "stale");
    await expect(generateSchemas(root, true)).rejects.toThrow("not registered");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
