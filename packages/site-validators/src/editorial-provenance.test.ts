import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { validateEditorialProvenance } from "./editorial-provenance.js";
const registry = JSON.parse(readFileSync("content/registry/editorial/provenance.json", "utf8"));
const sources = new Map<string, string>(
  registry.records.map((row: { path: string }) => [row.path, readFileSync(row.path, "utf8")]),
);
describe("current editorial evidence", () => {
  it("binds the existing current MDX and identity without a migration baseline", () => {
    expect(validateEditorialProvenance(registry, sources).records).toHaveLength(10);
  });
  it("rejects missing, changed and reassigned source bytes", () => {
    const path = registry.records[0].path;
    const missing = new Map(sources);
    missing.delete(path);
    expect(() => validateEditorialProvenance(registry, missing)).toThrow("MISSING");
    const changed = new Map(sources);
    changed.set(path, sources.get(path)! + "\n");
    expect(() => validateEditorialProvenance(registry, changed)).toThrow("MISMATCH");
    const bad = structuredClone(registry);
    bad.records[0].provenance.contentId = crypto.randomUUID();
    expect(() => validateEditorialProvenance(bad, sources)).toThrow("MISMATCH");
  });
  it("rejects duplicate entries and paths outside non-article content", () => {
    const duplicated = structuredClone(registry);
    duplicated.records.push(duplicated.records[0]);
    expect(() => validateEditorialProvenance(duplicated, sources)).toThrow();
    const bad = structuredClone(registry);
    bad.records[0].path = "../../secrets";
    expect(() => validateEditorialProvenance(bad, sources)).toThrow();
  });
});
