import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {localBrowser} from './browser.mjs';
import {visualTheme, hash} from './theme.mjs';
import {mermaidInput, chartInput, limits} from './inputs.mjs';
import {staticSvg} from './svg.mjs';
import {renderChart} from './chart.mjs';
import {loadSiteFonts} from './fonts.mjs';
const require = createRequire(import.meta.url);
let session;
const close = async () => await session?.close();

async function render({mode, source, runtime}) {
  const theme = await visualTheme();
  const metadata = mode === 'mermaid' ? mermaidInput(source) : chartInput(source);
  if (mode === 'chart') {
    const rendered=await renderChart(source,theme);
    const minimumMobileText=theme.fontSize*Math.min(1,280/rendered.width);
    if (minimumMobileText<14) throw Error('Wide chart would make mobile labels illegible; shorten axis labels or split the figure');
    const sharp=createRequire(new URL('../../../apps/site/package.json',import.meta.url))('sharp');
    const png=await sharp(Buffer.from(rendered.svg),{limitInputPixels:limits.pixels}).png().toBuffer();
    if (png.length>6*1024*1024) throw Error('PNG budget exceeded');
    return {...rendered,png:png.toString('base64'),minimumMobileText,theme,
      tools:{...rendered.tools,node:process.versions.node,sharp:sharp.versions.sharp},externalRequests:0};
  }
  session=await localBrowser(runtime);
  const {browser}=session;
  const context = await browser.newContext({offline:true,serviceWorkers:'block',viewport:{width:1200,height:900},locale:'ja-JP'});
  const requests = [];
  await context.route('**/*', route => {requests.push(route.request().url()); return route.abort();});
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.setContent('<!doctype html><html lang="ja"><meta charset="utf-8"><body></body></html>');
  const fontText=metadata.nodes.map(node=>node.label).join('')+metadata.edges.map(edge=>edge.label??'').join('');
  const fontBinding=await loadSiteFonts(page,fontText);
  let raw, tools;
  if (mode === 'mermaid') {
    const bundlePath = require.resolve('mermaid/dist/mermaid.min.js');
    const bundle = await readFile(bundlePath,'utf8');
    await page.addScriptTag({content:bundle});
    raw = await page.evaluate(async ({source,theme,limits}) => {
      globalThis.mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,suppressErrorRendering:true,
        maxTextSize:limits.inputBytes,maxEdges:limits.edges,theme:'base',fontFamily:theme.font,fontSize:theme.fontSize,
        themeVariables:{fontFamily:theme.font,fontSize:theme.fontSize+'px',background:theme.background,
          primaryColor:theme.background,primaryTextColor:theme.foreground,primaryBorderColor:theme.accent,
          lineColor:theme.muted,secondaryColor:theme.background,tertiaryColor:theme.background},
        flowchart:{htmlLabels:false,useMaxWidth:false,nodeSpacing:24,rankSpacing:32,padding:10,curve:'linear'}});
      return (await globalThis.mermaid.render('technical-figure',source)).svg;
    },{source,theme,limits});
    tools = {mermaid:JSON.parse(await readFile(require.resolve('mermaid/package.json'),'utf8')).version,mermaidBundleSha256:hash(bundle),fontBinding};
  }
  // Convert the fixed renderer's computed style to static presentation attributes.
  // No stylesheet or arbitrary style attribute survives into the exported SVG.
  const normalized = await page.evaluate(({raw,title,description}) => {
    if (/<!|<\?/i.test(raw)) throw Error('Unexpected SVG declaration');
    const parsed = new DOMParser().parseFromString(raw,'image/svg+xml');
    if (parsed.querySelector('parsererror,script,foreignObject,image,a,animate,animateTransform,set,iframe')) throw Error('Non-static SVG output');
    const svg = document.importNode(parsed.documentElement,true); document.body.replaceChildren(svg);
    const properties = ['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','fill-opacity','stroke-opacity','opacity','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline'];
    for (const node of [svg,...svg.querySelectorAll('*')]) {
      const style = getComputedStyle(node);
      for (const property of properties) {
        const value = style.getPropertyValue(property);
        if (value) node.setAttribute(property,value.replace(/url\(["']?[^#)]*#([^)'"\s]+)["']?\)/g,'url(#$1)'));
      }
    }
    svg.querySelectorAll('style,title,desc,filter').forEach(node=>node.remove());
    for (const node of [svg,...svg.querySelectorAll('*')]) {
      node.removeAttribute('style'); node.removeAttribute('filter');
      for(const attribute of [...node.attributes])if(attribute.name.startsWith('data-'))node.removeAttribute(attribute.name);
    }
    const ns = 'http://www.w3.org/2000/svg';
    const add = (name,id,text) => {const element = document.createElementNS(ns,name);element.id=id;element.textContent=text;svg.prepend(element);};
    add('desc','technical-description',description);add('title','technical-title',title);
    svg.setAttribute('role','img');svg.setAttribute('aria-labelledby','technical-title technical-description');
    svg.removeAttribute('aria-describedby');svg.removeAttribute('aria-roledescription');
    if (!svg.hasAttribute('viewBox')) svg.setAttribute('viewBox',`0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`);
    const box = svg.viewBox.baseVal; svg.setAttribute('width',String(Math.ceil(box.width)));svg.setAttribute('height',String(Math.ceil(box.height)));
    return new XMLSerializer().serializeToString(svg);
  },{raw,title:metadata.title,description:metadata.description});
  const checked = staticSvg(normalized);
  const minimumMobileText = theme.fontSize * Math.min(1,280/checked.width);
  if (minimumMobileText < 14) throw Error('Wide figure would make mobile labels illegible: use shorter labels, flowchart TB or split into separate figures');
  // The page contains only our checked, self-contained SVG. Raster is a local poster, not a measurement claim.
  await page.setViewportSize({width:checked.width,height:checked.height});
  await page.setContent('<html lang="ja"><meta charset="utf-8"><body style="margin:0;background:'+theme.background+'">'+checked.svg+'</body></html>');
  await loadSiteFonts(page,fontText);
  const png = await page.locator('svg').screenshot({type:'png',timeout:15000});
  if (png.length > 6*1024*1024 || requests.length) throw Error('Output budget or offline resource boundary failed');
  return {svg:checked.svg,png:png.toString('base64'),width:checked.width,height:checked.height,nodeCount:checked.nodeCount,
    minimumMobileText,theme,tools:{...tools,node:process.versions.node,chromium:browser.version()},metadata,externalRequests:requests.length};
}

const runtime=process.argv[2];
let reply;
try {
  const request=JSON.parse(await readFile(join(runtime,'request.json'),'utf8'));
  reply={type:'result',result:await render(request)};
} catch(error) {reply={type:'error',message:String(error.message).slice(0,1600)};process.exitCode=1;}
finally {
  try {const browserCleanup=await close();if(reply.type==='result')reply.result.browserCleanup=browserCleanup??{mode:'not_required',processExited:true};} catch(error) {reply={type:'error',message:error.message};process.exitCode=1;}
  await writeFile(join(runtime,'result.json'),JSON.stringify(reply),{flag:'wx'});
}
