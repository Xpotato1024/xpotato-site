import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { fileURLToPath } from "node:url";
import { bundledOutlineFont } from "../../../packages/media-ingest/src/bundled-outline-font.ts";
import { repository, hash } from "./theme.mjs";
const root = fileURLToPath(repository);
let regular, medium;
function font(weight = 400) {
  if (weight >= 500)
    return (medium ??= bundledOutlineFont(root, { family: "Zen Kaku Gothic New", weight: 500 }));
  return (regular ??= bundledOutlineFont(root, { family: "Zen Kaku Gothic New", weight: 400 }));
}
/** Exact repository font outlines, not an OS-font substitution. No font bytes are exported. */
export function outlineChartText(svg) {
  const tree = fromHtml(svg, { fragment: true });
  let textCount = 0;
  function walk(node) {
    if (node.type === "element" && node.tagName === "text") {
      if (node.children.some((child) => child.type !== "text"))
        throw Error("Unexpected chart text structure");
      const value = node.children.map((child) => child.value).join(""),
        p = node.properties ?? {};
      const size = Number(String(p.fontSize ?? "18").replace(/px$/u, "")),
        weight = Number(p.fontWeight ?? 400);
      if (!Number.isFinite(size) || size <= 0 || size > 72 || !Number.isFinite(weight))
        throw Error("Chart font budget");
      const selected = font(weight),
        width = selected.shapedWidth(value, size);
      let x = Number(p.x ?? 0),
        y = Number(p.y ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || p.dx || p.dy || p.dominantBaseline)
        throw Error("Unsupported chart text positioning");
      if (p.textAnchor === "middle") x -= width / 2;
      else if (p.textAnchor === "end") x -= width;
      const outlined = fromHtml(
        '<svg xmlns="http://www.w3.org/2000/svg">' +
          selected.shapedPaths(value, x, y, size, String(p.fill ?? "currentColor")) +
          "</svg>",
        { fragment: true },
      ).children[0].children[0];
      outlined.properties = {
        ...outlined.properties,
        ...(p.transform ? { transform: p.transform } : {}),
        ...(p.opacity === undefined ? {} : { opacity: p.opacity }),
        ariaLabel: value,
      };
      textCount++;
      return outlined;
    }
    if (node.children) node.children = node.children.map(walk);
    return node;
  }
  const result = walk(tree);
  if (!textCount) throw Error("Chart text missing");
  return { svg: toHtml(result), fontBinding: font().binding, textCount };
}
/** Load used repository-local subsets into an isolated browser before layout. */
export async function loadSiteFonts(page, text) {
  const chars = new Set(Array.from(text).map((c) => c.codePointAt(0)));
  font().width(text.replace(/[\r\n\t]/gu, ""), 18);
  const css = await readFile(join(root, "packages/design-system/src/fonts.css"), "utf8"),
    selected = [];
  for (const block of css.match(/@font-face\s*\{[^}]+\}/gu) ?? []) {
    if (
      !block.includes("font-family: 'Zen Kaku Gothic New'") ||
      !block.includes("font-weight: 400;")
    )
      continue;
    const name = /url\(\/fonts\/(font-[a-f0-9]{16}\.woff2)\)/u.exec(block)?.[1],
      range = /unicode-range:\s*([^;]+);/u.exec(block)?.[1];
    if (!name || !range) throw Error("Technical font manifest invalid");
    const covers = range.split(",").some((item) => {
      const m = /^\s*U\+([a-f0-9]+)(?:-([a-f0-9]+))?\s*$/iu.exec(item);
      if (!m) throw Error("Technical font range");
      const a = parseInt(m[1], 16),
        b = parseInt(m[2] ?? m[1], 16);
      return [...chars].some((c) => c >= a && c <= b);
    });
    if (!covers) continue;
    const bytes = await readFile(join(root, "apps/site/public/fonts", name));
    if (!name.includes(hash(bytes).slice(0, 16))) throw Error("Technical font bytes mismatch");
    selected.push({ range, bytes: Array.from(bytes) });
  }
  if (!selected.length) throw Error("Technical font subsets missing");
  await page.evaluate(
    async ({ selected, text }) => {
      for (const source of selected) {
        const face = new FontFace("Zen Kaku Gothic New", new Uint8Array(source.bytes), {
          weight: "400",
          style: "normal",
          unicodeRange: source.range,
        });
        await face.load();
        document.fonts.add(face);
      }
      await document.fonts.load('18px "Zen Kaku Gothic New"', text);
      await document.fonts.ready;
      if (!document.fonts.check('18px "Zen Kaku Gothic New"', text))
        throw Error("Technical font load failed");
    },
    { selected, text },
  );
  return font().binding;
}
