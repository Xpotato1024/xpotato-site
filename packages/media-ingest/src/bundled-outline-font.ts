import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fingerprint, sha256 } from "@xpotato/content-contracts/canonical";

type Glyph = { id: number; advanceWidth: number; bbox:{minX:number;minY:number;maxX:number;maxY:number}; path: { toSVG(): string } };
type Font = { unitsPerEm: number; ascent:number; descent:number; hasGlyphForCodePoint(code: number): boolean; glyphForCodePoint(code: number): Glyph;
 layout(text:string):{glyphs:Glyph[];positions:{xAdvance:number;xOffset:number;yOffset:number}[]} };
type Face = { file: string; sha256: string; bytes: Buffer; ranges: [number, number][]; font?: Font };
const { create } = createRequire(import.meta.url)("fontkit") as { create(bytes: Buffer): Font };
export const outlineFontProfile = Object.freeze({ family: "Zen Kaku Gothic New", weight: 500, fontkit: "2.0.4", fallback: false });
export const escapeSvgText = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Use the Git-bundled OFL subsets directly. Neither fontconfig nor SVG <text>
// resolves a face: every requested character must have a non-.notdef glyph.
export function bundledOutlineFont(repositoryRoot: string, selection?:{family:'Noto Serif JP'|'Zen Kaku Gothic New';weight:400|500}) {
  const profile=selection?{...outlineFontProfile,...selection}:outlineFontProfile;
  const canonicalText = (text: string) => text.replace(/\r\n?/gu, "\n");
  const css = canonicalText(readFileSync(join(repositoryRoot, "apps/site/src/styles/fonts.css"), "utf8"));
  const root = join(repositoryRoot, "apps/site/public/fonts");
  const license = canonicalText(readFileSync(join(root, profile.family==='Noto Serif JP'?'notoserifjp-OFL.txt':"zenkakugothicnew-OFL.txt"), "utf8"));
  if (!license.includes("SIL OPEN FONT LICENSE Version 1.1")) throw Error("CARD_FONT_LICENSE_INVALID");
  const faces: Face[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]+\}/gu) ?? []) {
    if (!block.includes(`font-family: '${profile.family}'`) || !block.includes(`font-weight: ${profile.weight};`)) continue;
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
  // Shaping is opt-in: preserve the exact legacy migration outlines above.
  function shaped(text:string,size:number){
    if(/\p{M}/u.test(text.normalize('NFC')))throw Error('CARD_COMBINING_GLYPH_UNSUPPORTED');
    const runs:{text:string;font:Font}[]=[];
    for(const char of Array.from(text.normalize('NFC'))){const {font}=resolve(char),last=runs.at(-1);if(last?.font===font)last.text+=char;else runs.push({text:char,font});}
    let cursor=0;const glyphs:{glyph:Glyph;x:number;y:number;scale:number}[]=[];
    for(const run of runs){const layout=run.font.layout(run.text),scale=size/run.font.unitsPerEm;
      for(let i=0;i<layout.glyphs.length;i++){const glyph=layout.glyphs[i]!,p=layout.positions[i]!;if(!glyph.id)throw Error('CARD_SHAPING_GLYPH_MISSING');
        glyphs.push({glyph,x:cursor+p.xOffset*scale,y:p.yOffset*scale,scale});cursor+=p.xAdvance*scale;}}
    return {glyphs,width:cursor};
  }
  function shapedPaths(text:string,x:number,y:number,size:number,fill:string){
    return `<g fill="${fill}">`+shaped(text,size).glyphs.map(g=>{const d=g.glyph.path.toSVG();return d?`<path d="${escapeSvgText(d)}" transform="translate(${round(x+g.x)} ${round(y-g.y)}) scale(${round(g.scale)} ${round(-g.scale)})"/>`:'';}).join('')+'</g>';
  }
  function inkBounds(text:string,size:number){
    const result=shaped(text,size),ink=result.glyphs.filter(g=>g.glyph.path.toSVG());
    return {width:result.width,minX:Math.min(0,...ink.map(g=>g.x+g.glyph.bbox.minX*g.scale)),maxX:Math.max(0,...ink.map(g=>g.x+g.glyph.bbox.maxX*g.scale)),
      minY:Math.min(0,...ink.map(g=>-g.y-g.glyph.bbox.maxY*g.scale)),maxY:Math.max(0,...ink.map(g=>-g.y-g.glyph.bbox.minY*g.scale))};
  }
  const baseline=(text:string,size:number,lineHeight:number)=>{const {font}=resolve(Array.from(text)[0]!);return (lineHeight*size-(font.ascent-font.descent)/font.unitsPerEm*size)/2+font.ascent/font.unitsPerEm*size;};
  return { width, paths, shapedWidth:(text:string,size:number)=>shaped(text,size).width, shapedPaths,inkBounds,baseline,binding: { ...profile, cssSha256: sha256(css), licenseSha256: sha256(license),
    manifestSha256: fingerprint(faces.map(({ file, sha256 }) => ({ file, sha256 })).sort((a, b) => a.file.localeCompare(b.file, "en"))) } };
}
