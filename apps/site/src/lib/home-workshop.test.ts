import { describe, expect, it } from "vitest";
import { mediaAssetRecordSchema } from "@xpotato/content-contracts";
import { homeWorkshopPicture } from "./home-workshop.js";
const hash = "a".repeat(64);
const object = (format: "avif" | "webp" | "jpeg", width: number) => ({ sha256: hash,
  objectKey: `media/v1/objects/sha256/aa/${hash}.${format === "jpeg" ? "jpg" : format}`,
  format, width, height: width * 9 / 16, sizeBytes: 100 });
const fixture = () => mediaAssetRecordSchema.parse({ assetId: "home-workshop", role: "hero", origin: "camera", status: "active",
  delivery: { mode: "responsive", profileId: "photo-hero-v1", profileSha256: hash,
    master: object("jpeg", 2400), variants: [1920, 1440, 960, 640].flatMap(width => ["avif", "webp", "jpeg"].map(format => object(format as "avif" | "webp" | "jpeg", width))) },
  defaultAlt: "工作台", provenanceRef: "legacy-git-source", rightsRef: "candidate-only" });
describe("homepage photo candidate rendering", () => {
  it("uses same-origin content-addressed URLs, original dimensions and mobile cover sizes", () => {
    const view = homeWorkshopPicture(fixture());
    expect(view.width).toBe(2400); expect(view.height).toBe(1350); expect(view.alt).toBe("工作台");
    expect(view.sizes).toBe("(max-width: 760px) 960px, 100vw");
    expect(view.src).toBe(`/media/v1/objects/sha256/aa/${hash}.jpg`);
    for (const format of ["avif", "webp", "jpeg"] as const) expect(view[format].split(", ").map(value => value.split(" ")[1])).toEqual(["640w", "960w", "1440w", "1920w"]);
    expect(view.avif).not.toContain("__design-preview");
  });
  it("rejects incomplete, substituted, unlabelled or retired bindings", () => {
    for (const patch of [{ status: "retired" }, { assetId: "other" }, { origin: "ai_generated" }, { defaultAlt: "" }]) {
      expect(() => homeWorkshopPicture({ ...fixture(), ...patch } as ReturnType<typeof fixture>)).toThrow();
    }
    const asset = fixture(); asset.delivery.master.width = 1200;
    expect(() => homeWorkshopPicture(asset)).toThrow();
  });
  it("rejects missing/duplicated variants, changed aspect or an object key/hash mismatch", () => {
    const missing = fixture(); missing.delivery.variants.pop(); expect(() => homeWorkshopPicture(missing)).toThrow();
    const duplicate = fixture(); duplicate.delivery.variants.push(duplicate.delivery.variants[0]!); expect(() => homeWorkshopPicture(duplicate)).toThrow();
    const aspect = fixture(); aspect.delivery.variants[0]!.height = 1; expect(() => homeWorkshopPicture(aspect)).toThrow();
    const drift = fixture(); drift.delivery.master.objectKey = drift.delivery.master.objectKey.replace(hash,"b".repeat(64));
    expect(() => homeWorkshopPicture(drift)).toThrow();
  });
});
