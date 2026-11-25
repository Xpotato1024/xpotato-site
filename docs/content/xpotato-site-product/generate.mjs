import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// Authoring-only, deterministic diagrams. No canonical registry or publication writes.
const repo = resolve(process.argv[2] ?? process.cwd());
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[3] ?? join(repo, ".local/product-article/visuals"));
await mkdir(out, { recursive: true });
const require = createRequire(join(repo, "package.json"));
const sharp = require("sharp");
const { technicalVisualTheme, loadDesignTokens } = await import(
  pathToFileURL(join(repo, "packages/design-system/src/theme.mjs"))
);
const { outlineChartText } = await import(pathToFileURL(join(repo, "ops/media/visuals/fonts.mjs")));
const { staticSvg } = await import(pathToFileURL(join(repo, "ops/media/visuals/svg.mjs")));
const { bundledOutlineFont } = await import(
  pathToFileURL(join(repo, "packages/media-ingest/src/bundled-outline-font.ts"))
);
const theme = await technicalVisualTheme();
const tokens = await loadDesignTokens();
const colors = {
  ...theme,
  card: tokens.resolve("--surface-control"),
  border: tokens.resolve("--border-control"),
};
const font = bundledOutlineFont(repo, { family: "Zen Kaku Gothic New", weight: 400 });
const fontMedium = bundledOutlineFont(repo, { family: "Zen Kaku Gothic New", weight: 500 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const assets = {};
for (const [id, path, sourceUrl] of [
  ["cms", join(repo, "apps/editor/public/xpotato-cms.svg"), null],
  ["site", join(repo, "apps/site/public/xpotato-logo.svg"), null],
  [
    "github",
    join(sourceRoot, "source-assets/github-invertocat-black.svg"),
    "https://brand.github.com/GitHub_Logos.zip",
  ],
  [
    "astro",
    join(sourceRoot, "source-assets/astro-logo-dark.svg"),
    "https://astro.build/assets/press/astro-logo-dark.svg",
  ],
]) {
  const bytes = await readFile(path);
  const source = bytes.toString("utf8");
  const [, attributes, inner] = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/u.exec(source) ?? [];
  if (!attributes || !inner) throw Error("LOGO_ROOT_INVALID: " + id);
  const viewBox = /viewBox="([^"]+)"/u.exec(attributes)?.[1];
  if (!viewBox) throw Error("LOGO_VIEWBOX_MISSING: " + id);
  const dimensions = viewBox.split(/\s+/u).map(Number);
  assets[id] = {
    path: path.startsWith(repo + "/") ? path.slice(repo.length + 1) : path,
    sha256: sha(bytes),
    sourceUrl,
    inner,
    attributes,
    viewBox,
    ratio: dimensions[2] / dimensions[3],
  };
}
if (assets.cms.sha256 !== "7d636961cba1ddc4f7f46c7d3888d43a31c5b032e569a5df726d8f719f8936fb")
  throw Error("APPROVED_CMS_LOGO_CHANGED");

let checks = [];
function text(
  x,
  y,
  value,
  { size = 18, weight = 400, anchor = "middle", fill = colors.foreground, maxWidth = 320 } = {},
) {
  const width = (weight >= 500 ? fontMedium : font).shapedWidth(value, size);
  if (size < 18 || width > maxWidth + 0.01)
    throw Error(`TEXT_BUDGET: ${value} (${width} > ${maxWidth})`);
  checks.push({ value, size, width: +width.toFixed(3), maxWidth, x, y });
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${escape(value)}</text>`;
}
function rect(
  x,
  y,
  w,
  h,
  { stroke = colors.grid, fill = colors.card, dash = false, rx = 12, sw = 1.5 } = {},
) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ' stroke-dasharray="5 5"' : ""}/>`;
}
function line(d, { arrow = false, dashed = false, color = colors.accent, width = 2 } = {}) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${arrow ? ' marker-end="url(#arrow)"' : ""}${dashed ? ' stroke-dasharray="5 5"' : ""}/>`;
}
function logo(id, x, y, w) {
  const a = assets[id];
  const height = w / a.ratio;
  const attributes = a.attributes.replace(/\s(?:width|height|x|y)="[^"]*"/gu, "");
  return `<svg${attributes} x="${x}" y="${y}" width="${w}" height="${height.toFixed(5)}">${a.inner}</svg>`;
}
function glyph(kind, x, y, size = 34) {
  const body = {
    api: '<rect x="3" y="4" width="26" height="24" rx="4"/><path d="m12 11-5 5 5 5m8-10 5 5-5 5m-3-12-3 18"/>',
    storage:
      '<ellipse cx="16" cy="7" rx="12" ry="4"/><path d="M4 7v18c0 5.3 24 5.3 24 0V7M4 16c0 5.3 24 5.3 24 0"/>',
    shield: '<path d="M16 3 28 8v9c0 7-12 13-12 13S4 24 4 17V8z"/><path d="m10 16 4 4 8-9"/>',
    user: '<circle cx="16" cy="10" r="6"/><path d="M4 29v-3a12 12 0 0 1 24 0v3"/>',
    browser:
      '<rect x="2" y="4" width="28" height="24" rx="3"/><path d="M2 11h28m-22-4h.1M12 7h.1"/>',
    ai: '<rect x="3" y="7" width="26" height="22" rx="5"/><path d="M16 2v5m-7 15h14"/><circle cx="10" cy="15" r="1"/><circle cx="22" cy="15" r="1"/>',
    check: '<circle cx="16" cy="16" r="13"/><path d="m8 16 5 5L24 10"/>',
    file: '<path d="M7 3h12l7 7v19H7zM19 3v8h7M11 17h11m-11 6h8"/>',
    image:
      '<rect x="3" y="4" width="26" height="24" rx="3"/><circle cx="11" cy="11" r="3"/><path d="m5 26 8-9 5 5 5-8 6 9"/>',
  }[kind];
  if (!body) throw Error("UNKNOWN_GLYPH");
  return `<g transform="translate(${x} ${y}) scale(${size / 32})" fill="none" stroke="${colors.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}
function start(height, title, description) {
  checks = [];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${height}" viewBox="0 0 360 ${height}" role="img" aria-labelledby="figure-title figure-description"><title id="figure-title">${escape(title)}</title><desc id="figure-description">${escape(description)}</desc><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 7 4 1 7" fill="none" stroke="${colors.accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker></defs><rect width="360" height="${height}" fill="${colors.background}"/>`;
}
const figures = [];
function figure(id, height, title, description, draw) {
  const source = start(height, title, description) + draw() + "</svg>";
  figures.push({ id, height, title, description, source, labels: [...checks] });
}

figure(
  "architecture-editor",
  544,
  "編集画面と保存先の構成",
  "Xpotato CMSの画面をCloudflare Accessで守り、Cloudflare Workers上の編集APIへ保存を依頼する。編集APIは別の認証経路を持ち、MDXと変更履歴をGitHubに、制作中の画像をDraft専用R2に分けて保存する。",
  () =>
    [
      rect(12, 12, 336, 164, {
        stroke: colors.border,
        fill: colors.background,
        dash: true,
        rx: 16,
      }),
      glyph("shield", 37, 27, 25),
      text(204, 47, "Cloudflare Access", { weight: 500, maxWidth: 245 }),
      rect(36, 66, 288, 94, { stroke: colors.accent }),
      logo("cms", 47, 81, 62),
      text(121, 106, "Xpotato CMS", { anchor: "start", size: 22, weight: 500, maxWidth: 186 }),
      text(121, 135, "執筆・添削", { anchor: "start", maxWidth: 180 }),
      line("M180 160 V198", { arrow: true }),
      rect(36, 198, 288, 94),
      glyph("api", 53, 223, 42),
      text(115, 235, "編集 API", { anchor: "start", size: 22, weight: 500, maxWidth: 190 }),
      text(115, 264, "Cloudflare Workers", { anchor: "start", maxWidth: 194 }),
      line("M180 292 V354"),
      text(205, 339, "保存", { anchor: "start", fill: colors.muted, maxWidth: 80 }),
      line("M180 354 H93 V392", { arrow: true }),
      line("M180 354 H267 V392", { arrow: true }),
      rect(14, 392, 158, 136),
      logo("github", 74, 410, 38),
      text(93, 477, "GitHub", { size: 20, weight: 500, maxWidth: 138 }),
      text(93, 507, "MDX・履歴", { maxWidth: 138 }),
      rect(188, 392, 158, 136),
      glyph("storage", 248, 412, 38),
      text(267, 477, "Draft R2", { size: 20, weight: 500, maxWidth: 138 }),
      text(267, 507, "下書き画像", { maxWidth: 138 }),
    ].join(""),
);

figure(
  "architecture-delivery",
  662,
  "検証した成果物と保存済み画像を配信",
  "GitHubの確定した変更をGitHub Actionsで検証し、Astroで静的HTMLを生成する。本人の公開指示を受けてSite Workerへ配信する。公開R2の画像は別の媒体保存工程で準備され、読者のブラウザーは両方から内容を受け取る。",
  () =>
    [
      rect(50, 14, 260, 76),
      logo("github", 69, 34, 36),
      text(123, 45, "GitHub", { anchor: "start", size: 21, weight: 500, maxWidth: 169 }),
      text(123, 72, "確定した変更", { anchor: "start", maxWidth: 169 }),
      line("M180 90 V118", { arrow: true }),
      rect(34, 118, 292, 116),
      glyph("check", 50, 135, 31),
      text(95, 156, "GitHub Actions", { anchor: "start", size: 20, weight: 500, maxWidth: 216 }),
      logo("astro", 46, 175, 107),
      text(166, 200, "検証・ビルド", { anchor: "start", maxWidth: 145 }),
      line("M180 234 V253 H93 V276", { arrow: true }),
      rect(14, 276, 158, 88, { stroke: colors.accent }),
      glyph("user", 79, 288, 28),
      text(93, 344, "本人の公開指示", { maxWidth: 140 }),
      rect(188, 276, 158, 88, { dash: true }),
      text(267, 312, "媒体の保存工程", { maxWidth: 140 }),
      text(267, 342, "公開準備済み", { fill: colors.muted, maxWidth: 140 }),
      line("M93 364 V400", { arrow: true }),
      line("M267 364 V400", { arrow: true }),
      rect(14, 400, 158, 124),
      logo("site", 62, 414, 62),
      text(93, 484, "Site Worker", { size: 18, weight: 500, maxWidth: 140 }),
      text(93, 511, "HTML配信", { maxWidth: 140 }),
      rect(188, 400, 158, 124),
      glyph("storage", 248, 416, 38),
      text(267, 484, "公開 R2", { size: 20, weight: 500, maxWidth: 140 }),
      text(267, 511, "画像配信", { maxWidth: 140 }),
      line("M93 524 V553 H180"),
      line("M267 524 V553 H180"),
      line("M180 553 V584", { arrow: true }),
      rect(40, 584, 280, 62, { stroke: colors.accent }),
      glyph("browser", 55, 598, 32),
      text(104, 623, "読者のブラウザー", { anchor: "start", size: 20, weight: 500, maxWidth: 205 }),
    ].join(""),
);

figure(
  "authoring-flow",
  746,
  "人とAIが同じ原稿を育てる流れ",
  "人がCMSで編集する経路とAIエージェントが執筆する経路は、同じMDXとcontent作業ブランチを共有する。内容・図・表示を確認し、指摘があれば改稿する。本人確認後に正式な媒体保存・export・PRへ進み、本番配信には別の公開判断を置く。CMSからAIの自動起動は未接続で、引継ぎは手動。",
  () =>
    [
      rect(14, 14, 158, 130, { stroke: colors.accent }),
      logo("cms", 65, 24, 56),
      text(93, 106, "人の編集", { size: 20, weight: 500, maxWidth: 140 }),
      text(93, 132, "Xpotato CMS", { maxWidth: 140 }),
      rect(188, 14, 158, 130),
      glyph("ai", 246, 30, 42),
      text(267, 106, "AIエージェント", { size: 18, weight: 500, maxWidth: 140 }),
      text(267, 132, "手動で引継ぎ", { maxWidth: 140 }),
      line("M93 144 V172 H180"),
      line("M267 144 V172 H180"),
      line("M180 172 V194", { arrow: true }),
      rect(34, 194, 292, 78),
      logo("github", 52, 216, 34),
      text(105, 224, "同じ原稿", { anchor: "start", size: 22, weight: 500, maxWidth: 205 }),
      text(105, 252, "MDX・作業ブランチ", { anchor: "start", maxWidth: 205 }),
      line("M180 272 V308", { arrow: true }),
      rect(44, 308, 272, 86),
      text(180, 342, "内容・図・表示を確認", { size: 20, weight: 500, maxWidth: 244 }),
      text(180, 371, "指摘をもとに改稿", { maxWidth: 244 }),
      line("M316 351 H344 V233 H326", { arrow: true, dashed: true }),
      line("M180 394 V430", { arrow: true }),
      rect(44, 430, 272, 58, { stroke: colors.accent }),
      glyph("user", 62, 446, 27),
      text(108, 467, "本人が原稿を確認", { anchor: "start", size: 20, weight: 500, maxWidth: 194 }),
      line("M180 488 V524", { arrow: true }),
      rect(34, 524, 292, 90),
      text(180, 558, "正式保存・出力", { size: 20, weight: 500, maxWidth: 264 }),
      text(180, 588, "媒体の保存・書き出し・PR", { maxWidth: 264 }),
      line("M180 614 V622"),
      text(180, 644, "別の公開判断", { fill: colors.muted, maxWidth: 260 }),
      line("M180 653 V672", { arrow: true }),
      rect(50, 672, 260, 58, { stroke: colors.accent }),
      logo("site", 68, 684, 47),
      text(139, 709, "本番へ配信", { anchor: "start", size: 21, weight: 500, maxWidth: 153 }),
    ].join(""),
);

figure(
  "media-lifecycle",
  598,
  "下書きと公開媒体の保存先",
  "制作中のDraft画像は本人限定の別領域に置く。本人確認後の正式工程で、正規化済み原本を非公開のAへ、配信用データを公開のBへ保存し、実際に公開するbytesを別保存先のCへ保護する。CMSにA・B・Cへの直接操作権限を持たせない。",
  () =>
    [
      rect(24, 14, 312, 90, { dash: true }),
      glyph("image", 39, 37, 32),
      text(86, 49, "Draft：制作中の画像", {
        anchor: "start",
        size: 20,
        weight: 500,
        maxWidth: 234,
      }),
      text(180, 82, "本人限定・公開系と分離", { maxWidth: 284 }),
      line("M28 128 H332", { dashed: true, color: colors.grid, width: 1.5 }),
      text(180, 159, "本人確認後の正式保存", { fill: colors.muted, maxWidth: 300 }),
      rect(32, 182, 296, 94, { stroke: colors.accent }),
      glyph("file", 49, 211, 33),
      text(101, 215, "A  正規化済み原本", {
        anchor: "start",
        size: 20,
        weight: 500,
        maxWidth: 211,
      }),
      text(101, 247, "非公開／再変換に使う", { anchor: "start", maxWidth: 211 }),
      line("M180 276 V284"),
      text(180, 306, "配信用に変換", { fill: colors.muted, maxWidth: 280 }),
      line("M180 315 V332", { arrow: true }),
      rect(32, 332, 296, 94, { stroke: colors.accent }),
      glyph("image", 49, 361, 33),
      text(101, 365, "B  配信用データ", { anchor: "start", size: 20, weight: 500, maxWidth: 211 }),
      text(101, 397, "公開／読者へ届ける", { anchor: "start", maxWidth: 211 }),
      line("M180 426 V434"),
      text(180, 456, "公開した画像をそのまま保護", { fill: colors.muted, maxWidth: 290 }),
      line("M180 465 V482", { arrow: true }),
      rect(32, 482, 296, 100),
      glyph("shield", 49, 513, 33),
      text(101, 516, "C  公開画像の保護", {
        anchor: "start",
        size: 20,
        weight: 500,
        maxWidth: 211,
      }),
      text(101, 547, "別の保存先／復旧用", { anchor: "start", maxWidth: 211 }),
    ].join(""),
);

const outputRecords = [];
for (const figure of figures) {
  // Preserve a compact editable text SVG and deliver exact site-font outlined SVG/PNG.
  staticSvg(figure.source);
  const outlined = outlineChartText(figure.source);
  const checked = staticSvg(outlined.svg);
  const sourcePath = figure.id + ".source.svg";
  const svgPath = figure.id + ".svg";
  const pngPath = figure.id + ".png";
  const png = await sharp(Buffer.from(checked.svg))
    .resize({ width: 1080 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(out, sourcePath), figure.source + "\n");
  await writeFile(join(out, svgPath), checked.svg + "\n");
  await writeFile(join(out, pngPath), png);
  const pngInfo = await sharp(png).metadata();
  outputRecords.push({
    assetId: figure.id,
    title: figure.title,
    alt: figure.description,
    source: { path: sourcePath, sha256: sha(figure.source + "\n") },
    svg: {
      path: svgPath,
      sha256: sha(checked.svg + "\n"),
      width: checked.width,
      height: checked.height,
      nodes: checked.nodeCount,
    },
    png: {
      path: pngPath,
      sha256: sha(png),
      width: pngInfo.width,
      height: pngInfo.height,
      sizeBytes: png.length,
    },
    font: outlined.fontBinding,
    labels: figure.labels,
    minimumLabelAt280px: 14,
    validation: { staticSvg: true, fontGlyphs: true, labelWidthBounds: true },
  });
}
await writeFile(
  join(out, "manifest.json"),
  JSON.stringify(
    {
      protocol: "xpotato-product-article-visuals-v1",
      baseCommit: "dd133023c5e7f051b94a6f9e81b63a5157095e82",
      contentId: "325e1e0e-acd3-469f-a27d-476cf84b48fc",
      productionEligible: false,
      approval: false,
      purpose: "本人限定記事プレビュー用。構造の説明図であり、実運用の成功を証明するものではない。",
      theme,
      runtime: { node: process.version, sharp: sharp.versions.sharp },
      sourceAssets: Object.fromEntries(
        Object.entries(assets).map(([id, { inner, attributes, ratio, ...metadata }]) => [
          id,
          metadata,
        ]),
      ),
      references: [
        "docs/operations/editor-workflow.md",
        "docs/architecture/cms-implementation-status.md",
        "docs/operations/current-deployment-status.md",
        "docs/operations/article-media-publication-ci.md",
        "docs/architecture/media-delivery-rendering.md",
        "docs/operations/editor-brand-assets.md",
        "https://brand.github.com/foundations/logo",
        "https://astro.build/press/",
      ],
      figures: outputRecords,
    },
    null,
    2,
  ) + "\n",
);

// Local QA contact sheet; PNGs remain private and are not committed as content media.
const thumbs = await Promise.all(
  figures.map(async (figure) => ({
    input: await sharp(join(out, figure.id + ".png"))
      .resize({ width: 360 })
      .png()
      .toBuffer(),
    left: figures.indexOf(figure) * 380 + 10,
    top: 10,
  })),
);
await sharp({ create: { width: 1520, height: 766, channels: 3, background: colors.background } })
  .composite(thumbs)
  .png()
  .toFile(join(out, "contact-sheet.png"));
console.log(
  JSON.stringify(
    outputRecords.map(({ assetId, svg, png }) => ({ assetId, svg, png })),
    null,
    2,
  ),
);
