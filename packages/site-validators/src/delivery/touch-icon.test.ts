import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editorTouchIconPath, validateTouchIcon } from "./touch-icon.js";

const png = readFileSync(
  new URL("../../../../apps/site/public/icon-apple-touch.png", import.meta.url),
);
const link =
  '<link rel="apple-touch-icon" type="image/png" href="/icon-apple-touch.png" sizes="180x180">';
const page = (head = link, body = "") =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("Apple touch icon", () => {
  it("requires the CMS-specific icon for the editor and the original icon for other pages", () => {
    const editorPng = readFileSync(
      new URL("../../../../apps/editor/public/xpotato-cms-180.png", import.meta.url),
    );
    const editorPage = page(link.replace("/icon-apple-touch.png", editorTouchIconPath));
    expect(validateTouchIcon(editorPage, editorPng, editorTouchIconPath)).toEqual([]);
    expect(validateTouchIcon(page(), editorPng, editorTouchIconPath)).not.toEqual([]);
    expect(validateTouchIcon(editorPage, png)).not.toEqual([]);
  });
  it("accepts the committed opaque PNG", () => expect(validateTouchIcon(page(), png)).toEqual([]));
  it("rejects absent, duplicate, body-only, relative, wrong-size and SVG declarations", () => {
    for (const html of [
      page(""),
      page(link + link),
      page("", link),
      page(link.replace("/icon-apple-touch.png", "icon-apple-touch.png")),
      page(link.replace("180x180", "64x64")),
      page(link.replace("image/png", "image/svg+xml")),
    ]) {
      expect(validateTouchIcon(html, png)).toContain(
        "apple-touch-icon must declare one 180x180 PNG in head",
      );
    }
  });
  it("rejects missing, truncated, nonsquare and alpha-channel images", () => {
    const wrongSize = Buffer.from(png);
    wrongSize.writeUInt32BE(179, 20);
    const alpha = Buffer.from(png);
    alpha[25] = 6;
    for (const bytes of [Buffer.alloc(0), png.subarray(0, 32), wrongSize, alpha]) {
      expect(validateTouchIcon(page(), bytes)).toContain(
        "apple-touch-icon must be an opaque 180x180 RGB PNG",
      );
    }
  });
});
