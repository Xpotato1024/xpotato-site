import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { sha256 } from "@xpotato/content-contracts/canonical";
import { buildPhase6MediaRepositoryCandidate } from "../packages/site-validators/src/phase6-media-candidate.js";

// Private review output only. No content/export/publication/storage/provider API.
const root = resolve("."), output = join(root, ".local/migration/phase6/social-font-review");
const pr111 = process.argv[2] ? resolve(process.argv[2]) : undefined;
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const routes = (await json(join(root, "docs/migration/phase8-route-discovery-readiness-v1.json"))).contentRouteRecords;
const manifest = await buildPhase6MediaRepositoryCandidate();
const committed = await json(join(root, "docs/migration/media-repository-candidate-v1.json"));
assert.deepEqual(manifest.manifest, committed, "candidate must be regenerated first");
const expected = pr111 ? await json(join(pr111, "expected.json")) : [];
const comparisons = new Map(expected.map((row: { contentId: string }) => [row.contentId, row]));
const records = [];
await mkdir(join(output, "fixed"), { recursive: true });
await mkdir(join(output, "comparisons"), { recursive: true });
for (const source of manifest.manifest.deterministicSources.filter(row => row.role === "social_card")) {
  const route = routes.find((row: { contentId: string }) => row.contentId === source.contentId);
  assert.equal(route?.publicationState, "held_candidate");
  const svg = manifest.deterministicSourceBytes.get(`${source.contentId}\0${source.assetId}`)!;
  assert.equal(sha256(svg), source.sha256);
  assert.doesNotMatch(svg, /<text\b|<image\b|<use\b|href=|url\(/u);
  const encode = () => sharp(Buffer.from(svg), { failOn: "error" }).resize({ width: 1200, height: 630, fit: "fill" }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const png = await encode();
  assert.ok(png.equals(await encode()), "repeat raster bytes");
  assert.equal((await sharp(png).metadata()).width, 1200);
  await writeFile(join(output, "fixed", `${source.contentId}.png`), png);
  const comparison = comparisons.get(source.contentId) as { old: { sha256: string }; new: { sha256: string } } | undefined;
  let before;
  if (comparison && pr111) {
    const oldPng = await readFile(join(pr111, "old", `${source.contentId}.png`));
    const newPng = await readFile(join(pr111, "new", `${source.contentId}.png`));
    assert.equal(sha256(oldPng), comparison.old.sha256);
    assert.equal(sha256(newPng), comparison.new.sha256);
    await sharp({ create: { width: 1200, height: 1890, channels: 4, background: "#fff" } })
      .composite([{ input: oldPng, top: 0, left: 0 }, { input: newPng, top: 630, left: 0 }, { input: png, top: 1260, left: 0 }])
      .png().toFile(join(output, "comparisons", `${source.contentId}.png`));
    before = { pr111OldSha256: comparison.old.sha256, pr111NewSha256: comparison.new.sha256 };
  }
  records.push({ contentId: source.contentId, title: route.discovery.title, publicationState: route.publicationState,
    svgSha256: source.sha256, pngSha256: sha256(png), ...before });
}
if (pr111) assert.equal(records.filter(row => row.pr111OldSha256).length, 28);
for (let offset = 0; offset < records.length; offset += 4) {
  const images = await Promise.all(records.slice(offset, offset + 4).map(async (row, index) => ({
    input: await sharp(join(output, "fixed", `${row.contentId}.png`)).resize(600, 315).toBuffer(),
    top: Math.floor(index / 2) * 315, left: index % 2 * 600,
  })));
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#fff" } }).composite(images)
    .png().toFile(join(output, `contact-${String(offset / 4 + 1).padStart(2, "0")}.png`));
}
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(join(output, "index.html"), `<!doctype html><html lang="ja"><meta charset="utf-8"><title>保留記事 social card フォント確認</title>
<style>body{font-family:system-ui;max-width:1280px;margin:auto;padding:24px}img{max-width:100%;height:auto}article{margin:48px 0}code{overflow-wrap:anywhere}</style>
<h1>保留記事 social card フォント確認</h1><p>全44件 held_candidate。記事公開・本文変更なし。比較画像は上から PR111旧版・PR111新版・修正版。${pr111 ? "28組の元PNGのSHA-256を照合済み。" : "PR111 artifact未指定のため修正版のみ。"}</p>
${records.map(row => `<article><h2>${escape(row.title)}</h2><code>${row.contentId}</code><p><a href="fixed/${row.contentId}.png">修正版PNG 1200×630</a></p><img loading="lazy" src="${row.pr111OldSha256 ? "comparisons" : "fixed"}/${row.contentId}.png" alt="${escape(row.title)}"></article>`).join("\n")}</html>\n`);
await writeFile(join(output, "report.json"), JSON.stringify({ schemaVersion: 1, sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTreeChangesIncluded: Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()), node: process.version, sharpVersions: sharp.versions,
  pr111ArtifactId: pr111 ? 12374386354 : null, originalPairsVerified: pr111 ? 28 : 0,
  correctedCount: records.length, repeatRasterMatches: true, persistentMutationAuthorized: false, records }, null, 2) + "\n");
console.log(`Private font review: corrected=${records.length}; PR111 pairs=${pr111 ? 28 : 0}; ${output}`);
