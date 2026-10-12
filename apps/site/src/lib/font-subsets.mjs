import {createHash} from "node:crypto";
import {readFile,readdir,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {parse} from "parse5";

const parseRanges = range => range.split(",").map(part => {
    const value = part.trim().replace(/^U\+/iu, "");
    const [low, high = low] = value.includes("?") ? [value.replaceAll("?", "0"), value.replaceAll("?", "F")] : value.split("-");
    return [Number.parseInt(low,16),Number.parseInt(high,16)];
});
export function matchesUnicodeRange(codepoint, range) {return parseRanges(range).some(([low,high])=>codepoint>=low&&codepoint<=high);}

export function selectFontFaces(source, textByFamily) {
  const selected = [];
  const pointsByFamily=Object.fromEntries(Object.entries(textByFamily).map(([family,text])=>[family,[...new Set([...text].map(char=>char.codePointAt(0)))]]));
  for (const match of source.matchAll(/@font-face\s*\{([^}]+)\}/gu)) {
    const body = match[1];
    const family = /font-family:\s*'([^']+)'/u.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+)/u.exec(body)?.[1];
    if (!family || !range) throw new Error("Local font face lacks family or Unicode range");
    const ranges=parseRanges(range);
    if ((pointsByFamily[family]??[]).some(point => ranges.some(([low,high])=>point>=low&&point<=high))) {
      selected.push(match[0].replace(/\s+/gu, " ").replace(/\s*([{}:;,])\s*/gu, "$1"));
    }
  }
  return selected.join("\n") + "\n";
}

const textOf = node => node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(textOf).join("");
export function renderedFontText(html) {
  const families = {"Noto Serif": "", "Noto Serif JP": "", "Zen Kaku Gothic New": ""};
  const walk = node => {
    if (["head", "script", "style"].includes(node.tagName)) return;
    if (node.nodeName === "#text") families["Zen Kaku Gothic New"] += node.value;
    if (["h1", "h2"].includes(node.tagName)) {
      const englishDisplay = node.attrs?.some(a => a.name === "id" && a.value === "home-title");
      families[englishDisplay ? "Noto Serif" : "Noto Serif JP"] += textOf(node);
    }
    for (const attr of node.attrs ?? []) if (["alt", "placeholder", "aria-label"].includes(attr.name)) families["Zen Kaku Gothic New"] += attr.value;
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(html));
  return families;
}

export function routeFontIntegration() {
  return { name: "local-route-font-subsets", hooks: {
    "astro:config:setup": ({command,injectScript}) => {
      if(command === "dev") injectScript("page-ssr",`import ${JSON.stringify(fileURLToPath(new URL("../styles/fonts.css",import.meta.url)).replaceAll("\\","/"))}; import ${JSON.stringify(fileURLToPath(new URL("../styles/fonts-core.css",import.meta.url)).replaceAll("\\","/"))};`);
    },
    "astro:build:done": async ({dir, logger}) => {
    const root = fileURLToPath(dir);
    const [original,core] = await Promise.all(["../styles/fonts.css","../styles/fonts-core.css"].map(path=>readFile(new URL(path,import.meta.url),"utf8")));
    const source = original + "\n" + core;
    // Dynamic visible strings are local UI source, never held article bodies.
    const dynamic = await Promise.all([
      new URL("../search/search-client.ts", import.meta.url),
      new URL("../components/islands/PrimeFactorizer.tsx", import.meta.url),
      new URL("../../public/scripts/code-copy.js", import.meta.url),
    ].map(url => readFile(url, "utf8")));
    const uiText = dynamic.join("\n");
    const htmlPaths = [];
    const walk = async folder => {for (const entry of await readdir(folder, {withFileTypes: true})) {const path=join(folder,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()&&entry.name.endsWith(".html"))htmlPaths.push(path);}};
    await walk(root);await mkdir(join(root,"_astro"),{recursive:true});
    const documents = await Promise.all(htmlPaths.sort().map(async path => ({path, html: await readFile(path,"utf8")})));
    const searchFamilies = {"Noto Serif": "", "Noto Serif JP": "", "Zen Kaku Gothic New": ""};
    for(const {html} of documents) {
      if(!html.includes("data-search-id") || /<meta[^>]*content="noindex"/u.test(html)) continue;
      const text=renderedFontText(html);
      searchFamilies["Zen Kaku Gothic New"]+=text["Zen Kaku Gothic New"];
      searchFamilies["Noto Serif JP"]+=text["Noto Serif JP"];
    }
    const emitted = new Set();
    for (const {path,html} of documents) {
      if (!html.includes("</head>")) throw new Error("Built HTML has no font insertion point");
      const text = renderedFontText(html);text["Zen Kaku Gothic New"] += uiText;
      if(/[/\\]search[/\\]index\.html$/u.test(path)) {
        text["Zen Kaku Gothic New"]+=searchFamilies["Zen Kaku Gothic New"];
        text["Noto Serif JP"]+=searchFamilies["Noto Serif JP"];
      }
      const css = selectFontFaces(source,text);
      const hash = createHash("sha256").update(css).digest("hex").slice(0,16);
      const href = `/_astro/fonts-${hash}.css`;
      if(!emitted.has(href)){await writeFile(join(root,"_astro",`fonts-${hash}.css`),css,"utf8");emitted.add(href);}
      const preloadFaces=selectFontFaces(core,text);
      const preloads=[...preloadFaces.matchAll(/src:url\(([^)]+)\)/gu)].map(match=>`<link rel="preload" href="${match[1]}" as="font" type="font/woff2" crossorigin>`).join("");
      await writeFile(path,html.replace("</title>",`</title>${preloads}`).replace("</head>",`<link rel="stylesheet" href="${href}" data-font-subsets></head>`),"utf8");
    }
    logger.info(`Route font CSS: ${htmlPaths.length} pages, ${emitted.size} content-hashed subsets; original glyph slices and fonts preserved`);
  }}};
}
