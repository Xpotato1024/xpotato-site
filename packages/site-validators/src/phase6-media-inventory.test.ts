import { describe, expect, it } from "vitest";
import { phase6RoleHintsForReferenceKinds } from "./phase6-media-inventory.js";

describe("Phase 6 media raw inventory", () => {
  it("maps only unambiguous legacy reference contexts to role hints", () => {
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_hero_image"])).toEqual(["hero"]);
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_og_image"])).toEqual(["social_card"]);
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_overview_image"])).toEqual(["overview"]);
    expect(phase6RoleHintsForReferenceKinds(["body_reference"])).toEqual(["inline"]);
  });

  it("keeps cover/preview semantics unresolved instead of guessing", () => {
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_cover_image"])).toEqual(["unresolved"]);
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_preview_image"])).toEqual(["unresolved"]);
  });

  it("retains all role hints when one locator is used in multiple contexts", () => {
    expect(phase6RoleHintsForReferenceKinds(["frontmatter_hero_image", "body_reference"])).toEqual(["hero", "inline"]);
  });
});
