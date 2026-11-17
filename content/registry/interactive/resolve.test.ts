import { describe, expect, it } from "vitest";
import type { InteractiveModuleRecord } from "@xpotato/content-contracts";
import { requireActiveInteractiveModule } from "./resolve.js";

const active: InteractiveModuleRecord = {
  id: "prime-factorizer",
  framework: "react",
  componentId: "prime-factorizer-react-v1",
  hydration: "visible",
  allowedCollections: ["tools"],
  role: "primary_tool",
  status: "active",
  apiVersion: 1,
  budgetClass: "small",
};

describe("interactive module resolution", () => {
  it("returns an active module for an authorized collection", () => {
    expect(requireActiveInteractiveModule({ "prime-factorizer": active }, active.id, "tools")).toBe(active);
  });

  it("fails closed for unknown and retired modules", () => {
    expect(() => requireActiveInteractiveModule({}, "unknown", "tools")).toThrow(/Unknown interactive module/u);
    expect(() => requireActiveInteractiveModule({ "prime-factorizer": { ...active, status: "retired" } }, active.id, "tools"))
      .toThrow(/Unknown interactive module/u);
  });

  it("fails closed for unauthorized collection usage", () => {
    expect(() => requireActiveInteractiveModule({ "prime-factorizer": active }, active.id, "blog"))
      .toThrow(/not allowed in blog/u);
  });
});
