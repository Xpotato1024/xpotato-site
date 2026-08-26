import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const dist = resolve(process.cwd(), "apps/site/dist");
const contentOnly = await readFile(join(dist, "notes/infrastructure-foundation/index.html"), "utf8");
const search = await readFile(join(dist, "search/index.html"), "utf8");
const errors: string[] = [];
if (/<astro-island\b/iu.test(contentOnly)) errors.push("content-only fixture unexpectedly contains an Astro island");
if (/search-client/iu.test(contentOnly)) errors.push("content-only fixture unexpectedly loads search JavaScript");
if (!/<meta\s+name="robots"\s+content="noindex"/iu.test(search)) errors.push("/search/ must be noindex");
if (!/search-client/iu.test(search)) errors.push("/search/ must load the search client");
const indexFiles = (await readdir(join(dist, "search"))).filter((name) => name === "search-index.json");
if (indexFiles.length !== 1) errors.push("generated MiniSearch index missing");
if (errors.length > 0) throw new Error(`Static validation failed:\n${errors.join("\n")}`);
console.log("Static validation PASS");
