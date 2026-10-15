import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { parseStaticHeaderRules, headersForPath } from "../../../scripts/static-headers.mjs";
import { renderSecurityHeaderArtifact } from "./security-headers.js";

describe("generated static header rule application", () => {
  const artifact = renderSecurityHeaderArtifact({ scriptHashes: [], styleHashes: [], toolRoutes: ["/tools/one/", "/tools/two/"] });
  const rules = parseStaticHeaderRules(artifact);
  it("combines baseline and route CSP while keeping cache rules scoped", () => {
    for (const path of ["/tools/one/", "/tools/one/index.html", "/tools/two/"]) {
      const effective = headersForPath(path, rules);
      expect(effective["content-security-policy"]?.split(", ")).toHaveLength(2);
      expect(effective["content-security-policy"]).toContain("connect-src 'none'");
      expect(effective["cache-control"]).toBeUndefined();
    }
    expect(headersForPath("/search/", rules)["content-security-policy"]).not.toContain("connect-src 'none'");
    expect(headersForPath("/_astro/chunk.js", rules)["cache-control"]).toContain("immutable");
    expect(headersForPath("/fonts/font-deadbeef.woff2", rules)["cache-control"]).toContain("immutable");
    expect(headersForPath("/fonts/unversioned.woff2", rules)["cache-control"]).toBeUndefined();
  });
  it("delivers multiple CSPs as one additive header on the HTTP wire", async () => {
    const server = createServer((req, res) => { res.writeHead(200, headersForPath(decodeURIComponent(new URL(req.url!, 'http://localhost').pathname), rules)); res.end("fixture"); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw Error("No port");
    try {
      const response = await fetch("http://127.0.0.1:" + address.port + "/tools/two/");
      expect(response.headers.get("content-security-policy")?.split(", ")).toHaveLength(2);
      expect(response.headers.get("cache-control")).toBeNull();
      const encoded = await fetch("http://127.0.0.1:" + address.port + "/tools/two%2findex.html");
      expect(encoded.headers.get("content-security-policy")?.split(", ")).toHaveLength(2);
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
  it("fails closed on malformed/duplicate rules and platform size limits", () => {
    for (const source of ["  CSP: none", "/one/\n  X: a\n  X: b", "/one/\n/one/", "/:dynamic/\n  X: a",
      "/" + "x".repeat(2000), Array.from({ length: 101 }, (_, i) => "/route-" + i + "/").join("\n")]) {
      expect(() => parseStaticHeaderRules(source)).toThrow();
    }
  });
});
