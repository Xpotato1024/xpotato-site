import { describe, expect, it } from "vitest";
import { focusScrollDelta, softwareKeyboardOpen } from "./editorFocus.js";

const bounds = { top: 120, bottom: 360, left: 0, right: 390 };

describe("keeping the editing caret visible", () => {
  it("does not move a caret already inside the usable viewport", () => {
    expect(focusScrollDelta({ top: 160, bottom: 184, left: 40, right: 41 }, bounds)).toEqual({
      x: 0,
      y: 0,
    });
  });
  it("scrolls only enough to lift the caret above the keyboard", () => {
    expect(focusScrollDelta({ top: 420, bottom: 444, left: 40, right: 41 }, bounds)).toEqual({
      x: 0,
      y: 96,
    });
  });
  it("moves a caret out from under the sticky editing controls", () => {
    expect(focusScrollDelta({ top: 100, bottom: 124, left: 40, right: 41 }, bounds)).toEqual({
      x: 0,
      y: -32,
    });
  });
  it("reveals a long source line within its own horizontal scroll area", () => {
    expect(focusScrollDelta({ top: 160, bottom: 184, left: 420, right: 421 }, bounds)).toEqual({
      x: 43,
      y: 0,
    });
  });
  it("reduces the margin when a short viewport has only room for a line", () => {
    expect(
      focusScrollDelta(
        { top: 100, bottom: 124, left: 20, right: 21 },
        { ...bounds, top: 100, bottom: 124 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("software keyboard layout", () => {
  it("recognizes a focused field after the iOS visual viewport shrinks", () => {
    expect(softwareKeyboardOpen(true, 375, 844, 844, 1)).toBe(true);
  });
  it("retains the pre-keyboard height when the layout viewport also shrinks", () => {
    expect(softwareKeyboardOpen(true, 375, 375, 844, 1)).toBe(true);
  });
  it("does not hide writing tools for browser chrome movement or pinch zoom", () => {
    expect(softwareKeyboardOpen(true, 780, 844, 844, 1)).toBe(false);
    expect(softwareKeyboardOpen(true, 375, 844, 844, 1.5)).toBe(false);
    expect(softwareKeyboardOpen(false, 375, 844, 844, 1)).toBe(false);
  });
});
