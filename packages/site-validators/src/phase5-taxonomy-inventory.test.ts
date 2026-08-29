import { describe, expect, it } from "vitest";
import { normalizePhase5TaxonomyRawTerm } from "./phase5-taxonomy-inventory.js";

describe("Phase 5 taxonomy raw-term normalization", () => {
  it("uses NFKC, trim, and lowercase without inventing semantic aliases", () => {
    expect(normalizePhase5TaxonomyRawTerm("  TypeScript  ")).toBe("typescript");
    expect(normalizePhase5TaxonomyRawTerm("ＲＡＧ")).toBe("rag");
    expect(normalizePhase5TaxonomyRawTerm("webサーバー")).toBe("webサーバー");
    expect(normalizePhase5TaxonomyRawTerm("programing")).toBe("programing");
  });

  it("fails closed for empty or NUL-bearing raw terms", () => {
    expect(() => normalizePhase5TaxonomyRawTerm("   ")).toThrow(/empty/iu);
    expect(() => normalizePhase5TaxonomyRawTerm("bad\0term")).toThrow(/NUL/u);
  });
});
