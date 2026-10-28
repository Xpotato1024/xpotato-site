import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {browserSession,loaded,pause} from './article-concrete-browser.mjs';
import {assertPreviewExportable} from './article-preview-state.mjs';
import {createHash} from 'node:crypto';
const repo=fileURLToPath(new URL('../',import.meta.url)),base=join(repo,'.local/article-concrete'),record=JSON.parse(await readFile(join(base,'preview.json'),'utf8'));
const exportKind=assertPreviewExportable(record,process.argv.includes('--composition-only'));
assert.equal(createHash('sha256').update(await readFile(join(base,'cover.png'))).digest('hex'),record.heroSha256,'Hero changed after preview build');
assert.equal(record.productionEligible,false);const out=join(base,'export');await mkdir(out,{recursive:true});
const b=await browserSession(record.output,record.route);const evidence=[];
try{await loaded(b,'.prose h2');for(const width of [1440,390,320]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await loaded(b,'.prose h2');
 const o=await b.js('({viewport:innerWidth,scroll:document.documentElement.scrollWidth,figures:document.querySelectorAll(".prose figure").length,toc:[...document.querySelectorAll(".table-of-contents>ol>li>a")].map(a=>a.textContent),captionMin:Math.min(...[...document.querySelectorAll("figcaption")].map(x=>parseFloat(getComputedStyle(x).fontSize))),imgs:[...document.images].every(i=>i.naturalWidth>0)})');assert(o.scroll<=width);assert.equal(o.figures,3);assert(o.imgs);
 const doc=await b.send('DOM.getDocument'),fonts={};for(const sel of ['.prose>p','.prose h2']){const q=await b.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:sel});fonts[sel]=(await b.send('CSS.getPlatformFontsForNode',{nodeId:q.nodeId})).fonts;}assert(fonts['.prose>p'].some(f=>/Zen.*Kaku/i.test(f.familyName)&&f.isCustomFont));assert(fonts['.prose h2'].some(f=>/Noto.*Serif.*JP/i.test(f.familyName)&&f.isCustomFont));evidence.push({...o,fonts});}
 await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.js('window.scrollTo(0,0)');await loaded(b,'.prose h2');
 await b.send('Emulation.setEmulatedMedia',{media:'screen'});await pause(100);const dim=await b.send('Page.getLayoutMetrics');
 const desktop=await b.send('Page.printToPDF',{printBackground:true,displayHeaderFooter:false,scale:1,paperWidth:1440/96,paperHeight:(Math.ceil(dim.cssContentSize.height)+1000)/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,preferCSSPageSize:false,generateTaggedPDF:true,generateDocumentOutline:true});await writeFile(join(out,'article-desktop-composition.pdf'),Buffer.from(desktop.data,'base64'));
 await b.send('Emulation.setEmulatedMedia',{media:'print'});await pause(100);await b.js("(()=>{const s=document.createElement('style');s.textContent='@media print{.prose figure img{max-height:160mm;width:auto;margin-inline:auto;object-fit:contain} .prose h2,.prose h3{break-after:avoid} .prose p,.prose li{orphans:2;widows:2}}';document.head.append(s);return true})()");const a4=await b.send('Page.printToPDF',{printBackground:true,displayHeaderFooter:false,scale:1,paperWidth:210/25.4,paperHeight:297/25.4,marginTop:10/25.4,marginBottom:10/25.4,marginLeft:10/25.4,marginRight:10/25.4,preferCSSPageSize:false,generateTaggedPDF:true,generateDocumentOutline:true});await writeFile(join(out,'article-a4-composition.pdf'),Buffer.from(a4.data,'base64'));
 await writeFile(join(out,'verification.json'),JSON.stringify({kind:exportKind==='final-review'?'actual-site-render-final-hero':'composition-only-not-final',productionEligible:false,identity:record.identity,heroSha256:record.heroSha256,heroSize:[1200,675],browser:await b.send('Browser.getVersion'),evidence,official:record.official},null,2));
 }finally{await b.close()}
// An offline media bundle; fonts are deliberately excluded, not packaged.
let html=await readFile(join(record.output,'blog/article-infill-concrete/index.html'),'utf8');
const mime=p=>p.endsWith('.png')?'image/png':p.endsWith('.svg')?'image/svg+xml':'text/javascript';
for(const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]){const href=/href="([^"]+)"/.exec(m[0])?.[1];if(!href?.startsWith('/'))continue;let css=await readFile(join(record.output,href.slice(1)),'utf8');css=css.replaceAll('url(/fonts/','url(https://xpotato.net/fonts/');html=html.replace(m[0],'<style>'+css+'</style>')}
html=html.replace(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g,'');
for(const m of [...html.matchAll(/src="(\/[^\"]+)"/g)]){const src=m[1];if(src.startsWith('/__candidate_media/')||src.endsWith('.svg')){const bytes=await readFile(join(record.output,src.slice(1)));html=html.replace(m[0],'src="data:'+mime(src)+';base64,'+bytes.toString('base64')+'"')}else html=html.replace(m[0],'src="https://xpotato.net'+src+'"')}
html=html.replaceAll('href="/','href="https://xpotato.net/');await writeFile(join(out,'article-composition.html'),html);
for(const name of ['brand-strip.png','bambu-official.svg','cura-official.svg','cover.png','walls.png','orientation.png','roof.png'])await cp(join(base,name),join(out,name));
for(const name of ['article.mdx','editor-context.md','walls.svg','orientation.svg','roof.svg'])await cp(join(repo,'tests/fixtures/article-concrete',name),join(out,name));
const source=join(repo,'.agents/skills/japanese-technical-blog');await cp(source,join(out,'japanese-technical-blog'),{recursive:true});
console.log(JSON.stringify({export:out,viewports:evidence.map(e=>e.viewport),figures:3,fontsDistributed:false,heroFinal:exportKind==='final-review'},null,2));
