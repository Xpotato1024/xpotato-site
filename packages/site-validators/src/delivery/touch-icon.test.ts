import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateTouchIcon } from "./touch-icon.js";

const png = readFileSync(new URL("../../../../apps/site/public/icon-apple-touch.png", import.meta.url));
const link = '<link rel="apple-touch-icon" type="image/png" href="/icon-apple-touch.png" sizes="180x180">';
const page = (head = link, body = "") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("Apple touch icon", () => {
  it("accepts the committed opaque PNG", () => expect(validateTouchIcon(page(), png)).toEqual([]));
  it("rejects absent, duplicate, body-only, relative, wrong-size and SVG declarations", () => {
    for (const html of [page(""), page(link + link), page("", link), page(link.replace('/icon-apple-touch.png','icon-apple-touch.png')), page(link.replace('180x180','64x64')), page(link.replace('image/png','image/svg+xml'))]) {
      expect(validateTouchIcon(html, png)).toContain("apple-touch-icon must declare one 180x180 PNG in head");
    }
  });
  it("rejects missing, truncated, nonsquare and alpha-channel images", () => {
    const wrongSize = Buffer.from(png); wrongSize.writeUInt32BE(179,20);
    const alpha = Buffer.from(png); alpha[25]=6;
    for (const bytes of [Buffer.alloc(0),png.subarray(0,32),wrongSize,alpha]) {
      expect(validateTouchIcon(page(), bytes)).toContain("apple-touch-icon must be an opaque 180x180 RGB PNG");
    }
  });
});
