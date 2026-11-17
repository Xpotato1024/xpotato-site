import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compilePublicScript, readPublicScript } from "./public-scripts.mjs";
import {
  validateArticleMotionSource,
  articleMotionBudget,
} from "../../packages/site-validators/src/delivery/article-motion-runtime.js";
import {
  validatePrimePwaSource,
  primePwaBudget,
} from "../../packages/site-validators/src/delivery/prime-pwa-runtime.js";
import { validatePageShareSource } from "../../packages/site-validators/src/delivery/page-share-runtime.js";

describe("readable sources and bounded public delivery", () => {
  it.each(["article-motion.js", "page-share.js", "prime-pwa.js"])(
    "builds %s deterministically without altering its authored source",
    async (name) => {
      const path = new URL("../../apps/site/public/scripts/" + name, import.meta.url);
      const before = await readFile(path, "utf8");
      const first = await readPublicScript(name);
      expect(await readPublicScript(name)).toEqual(first);
      expect(await readFile(path, "utf8")).toBe(before);
      expect(first.length).toBeLessThan(Buffer.byteLength(before));
    },
  );
  it("retains the existing delivery budgets and reviewed-script rejection", async () => {
    const motion = await readPublicScript("article-motion.js");
    validateArticleMotionSource(motion.toString());
    expect(motion.length).toBeLessThanOrEqual(articleMotionBudget.raw);
    expect(gzipSync(motion).length).toBeLessThanOrEqual(articleMotionBudget.gzip);
    expect(() => validateArticleMotionSource(motion + "fetch('/');")).toThrow();
    validatePageShareSource((await readPublicScript("page-share.js")).toString());
    const prime = await readPublicScript("prime-pwa.js");
    validatePrimePwaSource(prime.toString());
    expect(prime.length).toBeLessThanOrEqual(primePwaBudget.raw);
    expect(gzipSync(prime).length).toBeLessThanOrEqual(primePwaBudget.gzip);
  });
  it("does not accept an arbitrary path or syntactically invalid script", () => {
    expect(() => compilePublicScript("../secret.js", "")).toThrow("PUBLIC_SCRIPT_NAME_INVALID");
    expect(() => compilePublicScript("example.js", "function {")).toThrow();
  });
});
