import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateHomeSearchMetadata } from "./home-search-metadata.js";
const publicDir = new URL("../../../apps/site/public/", import.meta.url);
const icons = new Map(["favicon.ico", "favicon.svg"].map(name => ["/" + name, readFileSync(new URL(name, publicDir))]));
const title = "ロボティクスとプログラミングの記録";
const description = "Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。";
const head = `<title>${title} | Xpotato</title><meta name="description" content="${description}"><link rel="canonical" href="https://xpotato.net/"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="https://xpotato.net/"><meta property="og:site_name" content="Xpotato"><link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="16x16 32x32 48x48 64x64"><link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any">`;
const page = (value = head, body = "") => `<!doctype html><html><head>${value}</head><body>${body}</body></html>`;
describe("home search metadata and favicon", () => {
  it("accepts public metadata and the actual committed icon files", () => expect(validateHomeSearchMetadata(page(), icons)).toEqual([]));
  it("rejects generic or duplicate titles, missing descriptions and wrong canonical", () => {
    for (const value of [head.replace(title + " | Xpotato", "Home | Xpotato"), head + "<title>duplicate</title>", head.replace('name="description"', 'name="unused"'), head.replace('href="https://xpotato.net/"', 'href="https://example.com/"')]) {
      expect(validateHomeSearchMetadata(page(value), icons).length).toBeGreaterThan(0);
    }
  });
  it("rejects obsolete internal explanation and accidentally noindex home", () => {
    for (const value of ["Xpotato vNext foundation", "Design Freeze済みcontractに基づく静的siteの代表fixtureです。"]) expect(validateHomeSearchMetadata(page(head, value), icons)).toContain("home: obsolete internal explanation");
    expect(validateHomeSearchMetadata(page(head + '<meta name="robots" content="noindex">'), icons)).toContain("home: unexpectedly noindex");
  });
  it("requires favicon links in head, including supported ICO and SVG types", () => {
    expect(validateHomeSearchMetadata(page(head.replace('href="/favicon.ico"', 'href="/missing.ico"')), icons)).toContain("home: favicon link /favicon.ico");
    expect(validateHomeSearchMetadata(page(head.replace('type="image/x-icon"', 'type="text/plain"')), icons)).toContain("home: favicon link /favicon.ico");
    expect(validateHomeSearchMetadata(page("", head), icons).length).toBeGreaterThan(0);
  });
  it("rejects missing, nonsquare and truncated icons without throwing", () => {
    expect(validateHomeSearchMetadata(page(), new Map())).toContain("home: missing favicon file /favicon.ico");
    const badSvg = Buffer.from(icons.get("/favicon.svg")!.toString().replace("600 600", "600 500"));
    expect(validateHomeSearchMetadata(page(), new Map([...icons, ["/favicon.svg", badSvg]]))).toContain("home: favicon SVG must have square viewBox and dimensions");
    const badIco = Buffer.from(icons.get("/favicon.ico")!); badIco[7] = 15;
    for (const bytes of [badIco, badIco.subarray(0, 12), badIco.subarray(0, 70)]) expect(validateHomeSearchMetadata(page(), new Map([...icons, ["/favicon.ico", bytes]]))).toContain("home: favicon ICO must contain valid square 16/32/48/64 bitmaps");
  });
  it("keeps every existing logo path, color and transform without stretching", () => {
    const logo = readFileSync(new URL("xpotato-logo.svg", publicDir), "utf8");
    const svg = icons.get("/favicon.svg")!.toString();
    expect(svg.match(/<path\b[^>]*>/gu)).toEqual(logo.match(/<path\b[^>]*>/gu));
    expect(svg).toContain('viewBox="346.75 327.5 600 600"');
    expect(svg).not.toContain("preserveAspectRatio=\"none\"");
  });
});
