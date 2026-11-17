import { describe, expect, it } from "vitest";
import { carouselIndex, canRotate, carouselSentinels } from "./carousel-state.js";
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
  it.each([2,3,6,30])("retains both neighbours when a sentinel is centred for %i items", count => {
    const {before,after}=carouselSentinels(count);
    const slots=[...before,...Array.from({length:count},(_,i)=>i),...after];
    for(let position=before.length-1;position<=before.length+count;position++){
      expect(slots[position-1]).toBe(carouselIndex(slots[position]!-1,count));
      expect(slots[position+1]).toBe(carouselIndex(slots[position]!+1,count));
    }
  });
  it.each([0,1])("adds no decorative copies for %i items", count=>expect(carouselSentinels(count)).toEqual({before:[],after:[]}));
  it.each(["user", "hover", "focus", "hidden", "motion", "outside", "pointer", "contact"])("honors independent %s pause reasons", reason => {
    const pauses = new Set([reason, "user"]); expect(canRotate(6, pauses)).toBe(false);
    pauses.delete(reason); if (reason !== "user") expect(canRotate(6, pauses)).toBe(false);
    pauses.clear(); expect(canRotate(6, pauses)).toBe(true);
  });
});
