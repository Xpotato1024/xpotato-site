import { describe, expect, it } from "vitest";
import { inspectHomeUpdatesMarkup, validateHomeUpdatesSource } from "./home-updates-runtime.js";
import { analyzeBuiltHtml } from "./security-headers.js";
const src = "/_astro/UpdateActivity.astro_astro_type_script_index_0_lang.abcdef.js";
const html = `<div data-update-activity></div><script type="module" src="${src}"></script>`;
describe("bounded home-only updates runtime", () => {
  it("admits only the one homepage component/module pair", () => {
    expect(inspectHomeUpdatesMarkup(html, "/").script).toBe(src);
    expect(inspectHomeUpdatesMarkup("<p>Article</p>", "/articles/example/").script).toBeUndefined();
    for (const [body,route] of [[html,"/about/"],[html.replace("data-update-activity", "data-other"),"/"],[html+html,"/"],[html.replace('type="module"','defer'),"/"],[html.replace(src,"https://elsewhere.invalid/a.js"),"/"],[html.replace(src,"/_astro/other.js"),"/"]]) expect(()=>inspectHomeUpdatesMarkup(body!,route!)).toThrow();
  });
  it("rejects dependencies, dynamic code, network and persisted state", () => {
    const marker = 'document.querySelector("[data-update-activity]");';
    expect(()=>validateHomeUpdatesSource(marker)).not.toThrow();
    for(const extra of ['import "react";','import("./other.js");','fetch("/api");','window.fetch("/api");','eval("x");','new WebSocket("wss://example.invalid");','localStorage.getItem("x");','x'.repeat(8001)]) expect(()=>validateHomeUpdatesSource(marker+extra)).toThrow();
  });
  it("keeps the ordinary content runtime rejection around the narrow component", () => {
    expect(analyzeBuiltHtml([{path:"index.html",html}]).errors).toEqual([]);
    expect(analyzeBuiltHtml([{path:"about/index.html",html}]).errors.length).toBeGreaterThan(0);
    expect(analyzeBuiltHtml([{path:"index.html",html:html+'<script src="/_astro/unknown.js" type="module"></script>'}]).errors).toContain('index.html: content-only route must not contain executable JavaScript');
  });
});
