import { describe, expect, it } from "vitest";
import { assertRevisionBudget, canTransition, transition } from "./state-machine.js";

describe("Article Job state machine", () => {
  it("accepts the frozen normal path and bounded revision loop", () => {
    expect(canTransition("CREATED", "SOURCES_READY")).toBe(true);
    expect(canTransition("CONTENT_AUDITED", "REVISION_REQUIRED")).toBe(true);
    expect(canTransition("REVISION_REQUIRED", "DRAFTED")).toBe(true);
    expect(canTransition("MEDIA_PROTECTED", "EXPORTED")).toBe(true);
  });

  it("rejects skipping approval and persistence gates", () => {
    expect(() => transition("CANDIDATE_READY", "HUMAN_APPROVED")).toThrow(/Invalid Article Job transition/);
    expect(() => transition("HUMAN_APPROVED", "MEDIA_PUBLISHED")).toThrow(/Invalid Article Job transition/);
    expect(() => transition("MEDIA_PUBLISHED", "EXPORTED")).toThrow(/Invalid Article Job transition/);
  });

  it("does not leave a terminal state", () => {
    expect(canTransition("BLOCKED", "SOURCES_READY")).toBe(false);
    expect(canTransition("EXPORTED", "FAILED")).toBe(false);
  });

  it("fails closed when the revision budget is exhausted", () => {
    expect(() => assertRevisionBudget(3, 2)).toThrow(/budget/);
  });
});
