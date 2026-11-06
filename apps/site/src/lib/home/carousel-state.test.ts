import { describe, expect, it } from "vitest";
import { carouselIndex, canRotate } from "./carousel-state.js";
describe("project carousel identity and rotation policy", () => {
  it.each([0, 1, 2, 6, 30])("keeps forward/backward loops bounded for %i items", count => {
    for (let step = -2 * count - 2; step <= 2 * count + 2; step++) {
      const index = carouselIndex(step, count);
      expect(index).toBeGreaterThanOrEqual(0); expect(index).toBeLessThan(Math.max(1, count));
      if (count > 0) expect(carouselIndex(index + count, count)).toBe(index);
    }
    expect(carouselIndex(-1, count)).toBe(Math.max(0, count - 1));
    expect(carouselIndex(count, count)).toBe(0);
  });
  it("never rotates empty or single-item lists", () => { expect(canRotate(0, new Set())).toBe(false); expect(canRotate(1, new Set())).toBe(false); });
  it.each(["user", "hover", "focus", "hidden", "motion", "outside", "pointer"])("honors independent %s pause reasons", reason => {
    const pauses = new Set([reason, "user"]); expect(canRotate(6, pauses)).toBe(false);
    pauses.delete(reason); if (reason !== "user") expect(canRotate(6, pauses)).toBe(false);
    pauses.clear(); expect(canRotate(6, pauses)).toBe(true);
  });
});
