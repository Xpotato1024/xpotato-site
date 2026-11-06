import { describe, expect, it } from "vitest";
import { inspectHomeCarouselMarkup, validateHomeCarouselSource } from "./home-carousel-runtime.js";
import { analyzeBuiltHtml } from "./security-headers.js";
const src = "/_astro/ProjectCarousel.astro_astro_type_script_index_0_lang.abcdef.js";
const html = `<div data-project-carousel></div><script type="module" src="${src}"></script>`;
describe("bounded home-only carousel runtime", () => {
  it("admits only the one homepage component/module pair", () => {
    expect(inspectHomeCarouselMarkup(html, "/").script).toBe(src);
    expect(inspectHomeCarouselMarkup("<p>Article</p>", "/articles/example/").script).toBeUndefined();
    for (const [body,route] of [[html,"/about/"],[html.replace("data-project-carousel", "data-other"),"/"],[html+html,"/"],[html.replace('type="module"','defer'),"/"],[html.replace(src,"https://elsewhere.invalid/a.js"),"/"],[html.replace(src,"/_astro/other.js"),"/"]]) expect(()=>inspectHomeCarouselMarkup(body!,route!)).toThrow();
  });
  it("rejects dependencies, dynamic code, network and persisted state", () => {
    const marker = 'document.querySelector("[data-project-carousel]");';
    expect(()=>validateHomeCarouselSource(marker)).not.toThrow();
    for(const extra of ['import "react";','import("./other.js");','fetch("/api");','window.fetch("/api");','eval("x");','new WebSocket("wss://example.invalid");','localStorage.getItem("x");','x'.repeat(8001)]) expect(()=>validateHomeCarouselSource(marker+extra)).toThrow();
  });
  it("keeps the ordinary content runtime rejection around the narrow component", () => {
    expect(analyzeBuiltHtml([{path:"index.html",html}]).errors).toEqual([]);
    expect(analyzeBuiltHtml([{path:"about/index.html",html}]).errors.length).toBeGreaterThan(0);
    expect(analyzeBuiltHtml([{path:"index.html",html:html+'<script src="/_astro/unknown.js" type="module"></script>'}]).errors).toContain('index.html: content-only route must not contain executable JavaScript');
  });
});
