import {createHash} from "node:crypto";
import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {parse} from "parse5";
import postcss from "postcss";
import {toolReleaseFontText} from "./tools/tool-release-font-text.mjs";

const siteRoot = new URL("../../",import.meta.url);
const {dependencies} = JSON.parse(await readFile(new URL("package.json",siteRoot),"utf8"));
export async function loadToolFontText(sourceRoot) {
  try { return await readFile(new URL("site/font-text.mjs",sourceRoot),"utf8"); }
  catch(error) { if(error.code!=="ENOENT") throw error; }
  // Older admitted releases predate the dedicated fixed-text file. Preserve
  // their rollback path by collecting their immutable local source, never input.
  const parts=[];
  const walk=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())await walk(path);
    else if(entry.isFile()&&/\.(?:mjs|js)$/u.test(entry.name))parts.push(await readFile(path,"utf8"));
  }};
  await walk(fileURLToPath(sourceRoot));
  return parts.join("\n");
}
const installations=JSON.parse(await readFile(new URL('../../config/browser-tools/installations.json',siteRoot),'utf8')).installations;
const toolFontTexts={};
for(const {pin}of installations){
 const expected='file:../../vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pin.toolId)||!/^v?[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(pin.releaseId)||dependencies[pin.packageName]!==expected)throw Error('Pinned local Tool font source required');
 const artifactRoot=new URL(expected.slice(5)+'/',siteRoot),manifestBytes=await readFile(new URL('browser-tool.json',artifactRoot));
 if(createHash('sha256').update(manifestBytes).digest('hex')!==pin.manifestSha256)throw Error('Tool font manifest pin mismatch');
 const manifest=JSON.parse(manifestBytes),dedicated=manifest.files.filter(f=>/(?:^|\/)site\/font-text\.mjs$/u.test(f.path));
 if(dedicated.length>1)throw Error('Ambiguous Tool font text');
 const text=dedicated.length?await readFile(new URL(dedicated[0].path,artifactRoot),'utf8'):await loadToolFontText(artifactRoot);
 if(dedicated.length&&createHash('sha256').update(text).digest('hex')!==dedicated[0].sha256)throw Error('Tool font text bytes differ');
 toolFontTexts[pin.toolId]=text+toolReleaseFontText;
}

const parseRanges = range => range.split(",").map(part => {
    const value = part.trim().replace(/^U\+/iu, "");
    const [low, high = low] = value.includes("?") ? [value.replaceAll("?", "0"), value.replaceAll("?", "F")] : value.split("-");
    return [Number.parseInt(low,16),Number.parseInt(high,16)];
});
export function matchesUnicodeRange(codepoint, range) {return parseRanges(range).some(([low,high])=>codepoint>=low&&codepoint<=high);}

// These @font-face descriptors default to normal (400 for weight). Omit only
// unambiguous defaults, never ranges, URLs, variable weights or duplicate declarations.
function compactFontFace(css) {
  const root = postcss.parse(css);
  root.walkAtRules("font-face", rule => {
    for (const [prop, values] of [["font-style", ["normal"]], ["font-weight", ["normal", "400"]]]) {
      const declarations = rule.nodes.filter(node => node.type === "decl" && node.prop.toLowerCase() === prop);
      if (declarations.length === 1 && !declarations[0].important && values.includes(declarations[0].value.trim())) declarations[0].remove();
    }
  });
  return root.toString().replace(/\s+/gu, " ").replace(/\s*([{}:;,])\s*/gu, "$1");
}

export function selectFontFaces(source, textByFamily, preferredSource = "") {
  const selected = [];
  const pointsByFamily=Object.fromEntries(Object.entries(textByFamily).map(([family,text])=>[family,[...new Set([...text].map(char=>char.codePointAt(0)))]]));
  const faces = css => [...css.matchAll(/@font-face\s*\{([^}]+)\}/gu)].map(match => {
    const body = match[1];
    const family = /font-family:\s*'([^']+)'/u.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+)/u.exec(body)?.[1];
    if (!family || !range) throw new Error("Local font face lacks family or Unicode range");
    const weight = /font-weight:\s*([^;]+)/u.exec(body)?.[1]?.trim().replace(/^normal$/u, '400').replace(/^bold$/u, '700') ?? '400';
    const style = /font-style:\s*([^;]+)/u.exec(body)?.[1]?.trim() ?? 'normal';
    const stretch = /font-stretch:\s*([^;]+)/u.exec(body)?.[1]?.trim() ?? 'normal';
    return { css: match[0], family, key: JSON.stringify([family, weight, style, stretch]), ranges: parseRanges(range) };
  });
  const preferred = faces(preferredSource);
  const covers = (face, point) => face.ranges.some(([low,high])=>point>=low&&point<=high);
  // Only reviewed core ranges (generated from the actual cmap) suppress originals.
  // Do not infer coverage between original slices: a declared range can include
  // characters absent from its binary. Preserve every surviving original face.
  for (const face of faces(source)) {
    if ((pointsByFamily[face.family]??[]).some(point => covers(face,point)
      && !preferred.some(core => core.key===face.key && covers(core,point)))) selected.push(face.css);
  }
  for (const face of preferred) {
    if ((pointsByFamily[face.family]??[]).some(point => covers(face,point))) selected.push(face.css);
  }
  return selected.map(compactFontFace).join("\n") + "\n";
}

// Only static article display headings are narrowed. Body/UI and Tool fonts keep
// their original ranges, including fallback for text not known at build time.
export function compactArticleHeadingRanges(css, textByFamily) {
  const points = [...new Set([...(textByFamily["Noto Serif JP"] ?? "")].map(char => char.codePointAt(0)))].sort((a,b) => a-b);
  const root = postcss.parse(css);
  root.walkAtRules("font-face", face => {
    const declarations = name => face.nodes.filter(node => node.type === "decl" && node.prop.toLowerCase() === name);
    const families = declarations("font-family"), ranges = declarations("unicode-range");
    if (families.length !== 1 || families[0].value.replace(/^['"]|['"]$/gu, "") !== "Noto Serif JP" || ranges.length !== 1) return;
    const selected = points.filter(point => matchesUnicodeRange(point, ranges[0].value));
    if (!selected.length) return;
    const groups = [];
    for (const point of selected) {
      const previous = groups.at(-1);
      if (previous && point === previous[1]+1) previous[1] = point;
      else groups.push([point,point]);
    }
    ranges[0].value = groups.map(([low,high]) => "U+"+low.toString(16)+(low === high ? "" : "-"+high.toString(16))).join(",");
  });
  return root.toString();
}

const textOf = node => node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(textOf).join("");
export function renderedFontText(html,{searchCollection=false}={}) {
  const families = {"Noto Serif": "", "Noto Serif JP": "", "Zen Kaku Gothic New": ""};
  const walk = node => {
    if (["head", "script", "style"].includes(node.tagName)) return;
    if(searchCollection&&node.attrs?.some(attr=>attr.name==="data-search-exclude"&&attr.value==="true"))return;
    if (node.nodeName === "#text") families["Zen Kaku Gothic New"] += node.value;
    if (node.attrs?.some(a => a.name === "data-font-family" && a.value === "japanese-display")) families["Noto Serif JP"] += textOf(node);
    if (["h1", "h2"].includes(node.tagName) && !node.attrs?.some(a => a.name === "data-font-family" && a.value === "body")) {
      const englishDisplay = node.attrs?.some(a => a.name === "id" && a.value === "home-title");
      families[englishDisplay ? "Noto Serif" : "Noto Serif JP"] += textOf(node);
    }
    for (const attr of node.attrs ?? []) if (["alt", "placeholder", "aria-label"].includes(attr.name)) families["Zen Kaku Gothic New"] += attr.value;
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(html));
  return families;
}

// Fixed UI text follows the component marker, including private preview routes.
// Never collect user input or computed results, and never send Tool text globally.
export function dynamicFontText(html, {search, code, share='', updates='', tools=toolFontTexts}) {
  const markers = {search:false,code:false,share:false,updates:false},modules=new Set();
  const walk = node => {
    const attrs = Object.fromEntries((node.attrs??[]).map(attr=>[attr.name,attr.value]));
    if ('data-update-activity' in attrs) markers.updates=true;
    if ('data-search-client' in attrs) markers.search=true;
    if (attrs['data-interactive-module']) modules.add(attrs['data-interactive-module']);
    if (node.tagName==='script' && attrs.src==='/scripts/code-copy.js') markers.code=true;
    if (node.tagName==='script' && attrs.src==='/scripts/page-share.js') markers.share=true;
    for(const child of node.childNodes??[]) walk(child);
  };
  walk(parse(html));
  return (markers.search?search:'')+(markers.code?code:'')+(markers.share?share:'')+(markers.updates?updates:'')+[...modules].map(id=>{if(typeof tools[id]!=='string')throw Error('Unregistered Tool font marker');return tools[id];}).join('');
}

export function routeFontIntegration() {
  return { name: "local-route-font-subsets", hooks: {
    "astro:config:setup": ({command,injectScript}) => {
      if(command === "dev") injectScript("page-ssr",`import ${JSON.stringify(fileURLToPath(new URL("../styles/fonts.css",import.meta.url)).replaceAll("\\","/"))}; import ${JSON.stringify(fileURLToPath(new URL("../styles/fonts-core.css",import.meta.url)).replaceAll("\\","/"))};`);
    },
    "astro:build:done": async ({dir, logger}) => {
    const root = fileURLToPath(dir);
    const [original,core] = await Promise.all(["../styles/fonts.css","../styles/fonts-core.css"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    // Dynamic visible strings are local UI source, never held article bodies.
    const [search,code,share,updateClient,updateModel] = await Promise.all([
      new URL("../search/search-client.ts", import.meta.url),
      new URL("../../public/scripts/code-copy.js", import.meta.url),
      new URL("../../public/scripts/page-share.js", import.meta.url),
      new URL("./home/update-activity-client.ts", import.meta.url),
      new URL("./home/update-activity.ts", import.meta.url),
    ].map(url => readFile(url, "utf8")));
    const htmlPaths = [];
    const walk = async folder => {for (const entry of await readdir(folder, {withFileTypes: true})) {const path=join(folder,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()&&entry.name.endsWith(".html"))htmlPaths.push(path);}};
    await walk(root);await mkdir(join(root,"_astro"),{recursive:true});
    const documents = await Promise.all(htmlPaths.sort().map(async path => ({path, html: await readFile(path,"utf8")})));
    const searchFamilies = {"Noto Serif": "", "Noto Serif JP": "", "Zen Kaku Gothic New": ""};
    for(const {html} of documents) {
      if(!html.includes("data-search-id") || /<meta[^>]*content="noindex"/u.test(html)) continue;
      const text=renderedFontText(html,{searchCollection:true});
      searchFamilies["Zen Kaku Gothic New"]+=text["Zen Kaku Gothic New"];
      searchFamilies["Noto Serif JP"]+=text["Noto Serif JP"];
    }
    const emitted = new Set();
    for (const {path,html} of documents) {
      if (!html.includes("</head>")) throw new Error("Built HTML has no font insertion point");
      const text = renderedFontText(html);text["Zen Kaku Gothic New"] += dynamicFontText(html,{search,code,share,updates:updateClient+updateModel});
      if(html.includes('data-search-client')) {
        text["Zen Kaku Gothic New"]+=searchFamilies["Zen Kaku Gothic New"];
        text["Noto Serif JP"]+=searchFamilies["Noto Serif JP"];
      }
      const selectedCss = selectFontFaces(original,text,core);
      const css = html.includes('data-search-collection="blog"') ? compactArticleHeadingRanges(selectedCss,text) : selectedCss;
      const hash = createHash("sha256").update(css).digest("hex").slice(0,16);
      const href = `/_astro/fonts-${hash}.css`;
      if(!emitted.has(href)){await writeFile(join(root,"_astro",`fonts-${hash}.css`),css,"utf8");emitted.add(href);}
      const preloadFaces=selectFontFaces(core,text);
      const preloads=[...preloadFaces.matchAll(/src:url\(([^)]+)\)/gu)].map(match=>`<link rel="preload" href="${match[1]}" as="font" type="font/woff2" crossorigin>`).join("");
      // The measured homepage core is small enough to avoid a blocking CSS
      // round trip. Other routes retain cacheable content-hashed stylesheets.
      // Publication generation hashes this inline style into the existing CSP.
      const stylesheet = path===join(root,"index.html")
        ? `<style data-font-subsets>${css}</style>`
        : `<link rel="stylesheet" href="${href}" data-font-subsets>`;
      await writeFile(path,html.replace("</title>",`</title>${preloads}`).replace("</head>",`${stylesheet}</head>`),"utf8");
    }
    logger.info(`Route font CSS: ${htmlPaths.length} pages, ${emitted.size} content-hashed subsets; original glyph slices and fonts preserved`);
  }}};
}
