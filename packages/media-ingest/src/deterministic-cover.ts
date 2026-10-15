import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {createRequire} from "node:module";
import {fingerprint,sha256} from "@xpotato/content-contracts/canonical";
import {sharpToolchainSha256} from "./sharp-runtime.js";

type Glyph={id:number;advanceWidth:number;path:{toSVG():string}};
type Font={unitsPerEm:number;hasGlyphForCodePoint(code:number):boolean;glyphForCodePoint(code:number):Glyph};
const {create}=createRequire(import.meta.url)("fontkit") as {create(bytes:Buffer):Font};
export const coverProfile=Object.freeze({id:"xpotato-outline-cover-v1",fontkit:"2.0.4",family:"Zen Kaku Gothic New",
 weight:500,textNormalization:"NFC-and-collapse-whitespace",hero:{width:2400,height:1260},social:{width:1200,height:630},
 title:{maxCodePoints:180,minFontSize:44,maxFontSize:72,maxLines:4,x:80,top:172,width:1040,height:336},
 colors:{background:"#f6f3ec",ink:"#292434",accent:"#745399"},noFallback:true,outlineOnly:true});
const noLineStart=new Set(Array.from("、。，．・：；？！ー）］｝〕〉》」』】々ぁぃぅぇぉっゃゅょァィゥェォッャュョ"));
const noLineEnd=new Set(Array.from("（［｛〔〈《「『【"));
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const rounded=(n:number)=>Math.round(n*10000)/10000;
type Face={file:string;sha256:string;ranges:readonly [number,number][];font?:Font};
export async function deterministicCover(input:{repositoryRoot:string;title:string;categoryLabel:string;pubDate:string}){
 const {repositoryRoot,title,categoryLabel,pubDate}=input;
 if(!title.trim()||Array.from(title).length>coverProfile.title.maxCodePoints
  ||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(title+categoryLabel)||!/^\d{4}-\d{2}-\d{2}$/u.test(pubDate))throw new Error("COVER_INPUT_INVALID");
 const css=await readFile(join(repositoryRoot,"apps/site/src/styles/fonts.css"),"utf8");
 const fontsRoot=join(repositoryRoot,"apps/site/public/fonts"),faces:Face[]=[];
 for(const block of css.match(/@font-face\s*\{[^}]+\}/gu)??[]){
  if(!block.includes("font-family: '"+coverProfile.family+"'")||!block.includes("font-weight: 500;"))continue;
  const file=/url\(\/fonts\/(font-[a-f0-9]{16}\.woff2)\)/u.exec(block)?.[1];
  const ranges=/unicode-range:\s*([^;]+);/u.exec(block)?.[1];
  if(!file||!ranges)throw new Error("COVER_FONT_MANIFEST_INVALID");
  const bytes=await readFile(join(fontsRoot,file)),hash=sha256(bytes);
  if(!file.includes(hash.slice(0,16)))throw new Error("COVER_FONT_HASH_INVALID");
  faces.push({file,sha256:hash,ranges:ranges.split(",").map(range=>{
   const match=/^\s*U\+([a-f0-9]+)(?:-([a-f0-9]+))?\s*$/iu.exec(range);
   if(!match)throw new Error("COVER_FONT_RANGE_INVALID");
   return [parseInt(match[1]!,16),parseInt(match[2]??match[1]!,16)] as [number,number];
  })});
 }
 if(!faces.length)throw new Error("COVER_FONT_MISSING");
 const selected=new Map<number,{face:Face;glyph:Glyph}>();
 async function glyphFor(char:string){
  const code=char.codePointAt(0)!;if(selected.has(code))return selected.get(code)!;
  for(const face of faces){
   if(!face.ranges.some(([from,to])=>code>=from&&code<=to))continue;
   face.font??=create(await readFile(join(fontsRoot,face.file)));
   if(!face.font.hasGlyphForCodePoint(code))continue;
   const glyph=face.font.glyphForCodePoint(code);
   if(glyph.id===0)continue;const result={face,glyph};selected.set(code,result);return result;
  }
  throw new Error("COVER_GLYPH_MISSING_U+"+code.toString(16).toUpperCase());
 }
 const normalized=title.normalize("NFC").trim().replace(/\s+/gu," ");
 for(const char of Array.from(normalized+categoryLabel+pubDate+"XPOTATO.NET / FIELD NOTES"))await glyphFor(char);
 const advance=(char:string,size:number)=>{const g=selected.get(char.codePointAt(0)!)!;return g.glyph.advanceWidth/g.face.font!.unitsPerEm*size;};
 function wrap(size:number){
  const chars=Array.from(normalized),lines:string[]=[];let line="",width=0;
  for(let i=0;i<chars.length;i++){
   const char=chars[i]!,next=chars[i+1],w=advance(char,size);
   if(line&&width+w>coverProfile.title.width){
    if(noLineStart.has(char)||noLineEnd.has(Array.from(line).at(-1)!))return null;
    lines.push(line.trimEnd());line="";width=0;
   }
   if(!line&&char===" ")continue;
   line+=char;width+=w;
   if(next&&noLineEnd.has(char)&&width+advance(next,size)>coverProfile.title.width)return null;
  }
  if(line)lines.push(line.trimEnd());
  return lines.length<=coverProfile.title.maxLines&&lines.length*size*1.16<=coverProfile.title.height?lines:null;
 }
 let fontSize=coverProfile.title.maxFontSize,lines:string[]|null=null;
 for(;fontSize>=coverProfile.title.minFontSize;fontSize-=2){lines=wrap(fontSize);if(lines)break;}
 if(!lines)throw new Error("COVER_TITLE_OVERFLOW");
 function outline(text:string,x:number,y:number,size:number,color:string){
  let cursor=x;const paths:string[]=[];
  for(const char of Array.from(text)){
   const g=selected.get(char.codePointAt(0)!)!,scale=size/g.face.font!.unitsPerEm,d=g.glyph.path.toSVG();
   if(d)paths.push('<path d="'+escape(d)+'" transform="translate('+rounded(cursor)+' '+rounded(y)+') scale('+rounded(scale)+' '+rounded(-scale)+')" />');
   cursor+=advance(char,size);
  }
  return '<g fill="'+color+'">'+paths.join("")+"</g>";
 }
 const label=categoryLabel+" / "+pubDate;
 if(Array.from(label).reduce((sum,c)=>sum+advance(c,22),0)>1040)throw new Error("COVER_LABEL_OVERFLOW");
 const logo=await readFile(join(repositoryRoot,"apps/site/public/xpotato-logo.svg"),"utf8");
 if(!/^<svg\b/u.test(logo)||/<(?:script|image|use|foreignObject)\b|\bon\w+=|(?:href|url)\s*[=(]/iu.test(logo))throw new Error("COVER_LOGO_UNSAFE");
 const logoPaths=logo.match(/<path\b[^>]*\/>/gu);if(!logoPaths?.length)throw new Error("COVER_LOGO_INVALID");
 const art='<rect width="1200" height="630" fill="#f6f3ec"/>'
  +'<path d="M970 0H1200V230ZM1032 630H1200V462Z" fill="#745399" opacity=".07"/>'
  +'<path d="M80 132H1120M80 535H1120" stroke="#745399" stroke-width="2" opacity=".35"/>'
  +'<g transform="translate(80 58) scale(.13) translate(-370 -440)">'+logoPaths.join("")+"</g>"
  +outline("XPOTATO.NET / FIELD NOTES",174,94,22,"#745399")
  +lines.map((line,i)=>outline(line,80,coverProfile.title.top+fontSize+i*fontSize*1.16,fontSize,"#292434")).join("")
  +outline(label,80,580,22,"#574869");
 const svg=(width:number,height:number)=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 1200 630"><title>'+escape(normalized)+'</title>'+art+"</svg>\n");
 const fontFiles=faces.map(({file,sha256})=>({file,sha256})).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
 const license=await readFile(join(fontsRoot,"zenkakugothicnew-OFL.txt"),"utf8");
 if(!license.includes("SIL OPEN FONT LICENSE Version 1.1"))throw new Error("COVER_FONT_LICENSE_INVALID");
 const binding={licenseSha256:sha256(license),profileId:coverProfile.id,profileSha256:fingerprint(coverProfile),fontManifestSha256:fingerprint(fontFiles),
  fontCssSha256:sha256(css),logoSha256:sha256(logo),implementationSha256:sha256(await readFile(new URL("./deterministic-cover.ts",import.meta.url))),
  toolchainSha256:fingerprint({fontkit:coverProfile.fontkit,sharp:sharpToolchainSha256()}),titleSha256:sha256(title),
  categoryLabel,pubDate,layout:{lines,fontSize,titleBox:coverProfile.title}};
 return {hero:svg(2400,1260),social:svg(1200,630),binding,derivationSha256:fingerprint(binding)};
}
