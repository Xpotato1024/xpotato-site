import { describe, expect, it, vi } from "vitest";
import { canonicalJson, fingerprint } from "./canonical.js";

describe("locale-independent canonical serialization", () => {
  it("produces identical bytes and fingerprints for different insertion orders", () => {
    const first = { z: 1, nested: { beta: 2, alpha: 1 }, a: 0 };
    const second = { a: 0, nested: { alpha: 1, beta: 2 }, z: 1 };
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(fingerprint(first)).toBe(fingerprint(second));
  });

  it("uses UTF-16 code-unit ordering without consulting localeCompare", () => {
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => {
      throw new Error("locale-sensitive collation must not be used");
    });
    try {
      const value = Object.fromEntries([["ä", 3], ["z", 2], ["a", 1]]);
      expect(canonicalJson(value)).toBe('{"a":1,"z":2,"ä":3}');
    } finally {
      localeCompare.mockRestore();
    }
  });

  it("is independent from differing explicit locale collations", () => {
    const keys = ["ä", "z", "a"];
    expect([...keys].sort(new Intl.Collator("en-US").compare)).not.toEqual(
      [...keys].sort(new Intl.Collator("sv-SE").compare),
    );
    const left = Object.fromEntries([...keys].sort(new Intl.Collator("en-US").compare).map((key) => [key, key]));
    const right = Object.fromEntries([...keys].sort(new Intl.Collator("sv-SE").compare).map((key) => [key, key]));
    expect(fingerprint(left)).toBe(fingerprint(right));
  });
});
