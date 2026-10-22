import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";

type Glyph = { id: number; advanceWidth: number; path: { toSVG(): string } };
type Font = { unitsPerEm: number; hasGlyphForCodePoint(code: number): boolean; glyphForCodePoint(code: number): Glyph };
type Face = { file: string; sha256: string; bytes: Buffer; ranges: [number, number][]; font?: Font };
const { create } = createRequire(import.meta.url)("fontkit") as { create(bytes: Buffer): Font };
export const outlineFontProfile = Object.freeze({ family: "Zen Kaku Gothic New", weight: 500, fontkit: "2.0.4", fallback: false });
export const escapeSvgText = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Use the Git-bundled OFL subsets directly. Neither fontconfig nor SVG <text>
// resolves a face: every requested character must have a non-.notdef glyph.
export function bundledOutlineFont(repositoryRoot: string) {
  const css = readFileSync(join(repositoryRoot, "apps/site/src/styles/fonts.css"), "utf8");
  const root = join(repositoryRoot, "apps/site/public/fonts");
  const license = readFileSync(join(root, "zenkakugothicnew-OFL.txt"), "utf8");
  if (!license.includes("SIL OPEN FONT LICENSE Version 1.1")) throw Error("CARD_FONT_LICENSE_INVALID");
  const faces: Face[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]+\}/gu) ?? []) {
    if (!block.includes(`font-family: '${outlineFontProfile.family}'`) || !block.includes(`font-weight: ${outlineFontProfile.weight};`)) continue;
    const file = /url\(\/fonts\/(font-[a-f0-9]{16}\.woff2)\)/u.exec(block)?.[1];
    const range = /unicode-range:\s*([^;]+);/u.exec(block)?.[1];
    if (!file || !range) throw Error("CARD_FONT_MANIFEST_INVALID");
    const bytes = readFileSync(join(root, file)), hash = sha256(bytes);
    if (!file.includes(hash.slice(0, 16))) throw Error("CARD_FONT_HASH_INVALID");
    const ranges = range.split(",").map(value => {
      const match = /^\s*U\+([a-f0-9]+)(?:-([a-f0-9]+))?\s*$/iu.exec(value);
      if (!match) throw Error("CARD_FONT_RANGE_INVALID");
      return [parseInt(match[1]!, 16), parseInt(match[2] ?? match[1]!, 16)] as [number, number];
    });
    faces.push({ file, sha256: hash, bytes, ranges });
  }
  if (!faces.length) throw Error("CARD_FONT_MISSING");
  const selected = new Map<number, { glyph: Glyph; font: Font }>();
  function resolve(char: string) {
    const code = char.codePointAt(0)!;
    const cached = selected.get(code);
    if (cached) return cached;
    for (const face of faces) {
      if (!face.ranges.some(([from, to]) => code >= from && code <= to)) continue;
      face.font ??= create(face.bytes);
      if (!face.font.hasGlyphForCodePoint(code)) continue;
      const glyph = face.font.glyphForCodePoint(code);
      if (!glyph.id || (!/\s/u.test(char) && !glyph.path.toSVG())) continue;
      const result = { glyph, font: face.font };
      selected.set(code, result);
      return result;
    }
    throw Error(`CARD_GLYPH_MISSING_U+${code.toString(16).toUpperCase()}`);
  }
  const width = (text: string, size: number): number => Array.from(text).reduce((sum, char) => {
    const { glyph, font } = resolve(char);
    return sum + glyph.advanceWidth / font.unitsPerEm * size;
  }, 0);
  const round = (value: number) => Math.round(value * 10000) / 10000;
  function paths(text: string, x: number, y: number, size: number, fill: string) {
    let cursor = x;
    return `<g fill="${fill}">` + Array.from(text).map(char => {
      const { glyph, font } = resolve(char), scale = size / font.unitsPerEm, d = glyph.path.toSVG();
      const path = d ? `<path d="${escapeSvgText(d)}" transform="translate(${round(cursor)} ${y}) scale(${round(scale)} ${round(-scale)})"/>` : "";
      cursor += glyph.advanceWidth * scale;
      return path;
    }).join("") + "</g>";
  }
  return { width, paths, binding: { ...outlineFontProfile, cssSha256: sha256(css), licenseSha256: sha256(license),
    manifestSha256: fingerprint(faces.map(({ file, sha256 }) => ({ file, sha256 })).sort((a, b) => a.file.localeCompare(b.file, "en"))) } };
}
