import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {browserSession,loaded,pause} from './article-concrete-browser.mjs';
import {assertPreviewExportable} from './article-preview-state.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),base=join(repo,'.local/article-concrete');
const record=JSON.parse(await readFile(join(base,'preview.json'),'utf8'));
const kind=assertPreviewExportable(record,process.argv.includes('--composition-only'));
assert.equal(createHash('sha256').update(await readFile(join(base,'cover.png'))).digest('hex'),record.heroSha256);
const out=join(base,'export');await mkdir(out,{recursive:true});
const b=await browserSession(record.output,record.route),evidence=[];
try{
 await loaded(b,'.article-body h2');
 if(kind!=='final-review')await b.js("(()=>{const style=document.createElement('style');style.textContent='.article-hero{display:none!important}';document.head.append(style);return true})()");
 for(const width of [1440,390,320]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await loaded(b,'.article-body h2');await b.js('scrollTo(0,0)');
  const state=await b.js(`(()=>{const lead=document.querySelector('.article-lead'),toc=document.querySelector('.table-of-contents');return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,bodyFont:parseFloat(getComputedStyle(lead).fontSize),figures:document.querySelectorAll('.prose figure').length,tables:document.querySelectorAll('.article-body table').length,leadBeforeToc:!!(lead.compareDocumentPosition(toc)&Node.DOCUMENT_POSITION_FOLLOWING),diagramLabels:[...document.querySelectorAll('.article-diagrams img')].map(i=>18*i.getBoundingClientRect().width/320),diagramWidths:[...document.querySelectorAll('.article-diagrams img')].map(i=>i.getBoundingClientRect().width),galleryColumns:[...document.querySelectorAll('.article-diagrams')].map(g=>getComputedStyle(g).gridTemplateColumns),imagesLoaded:[...document.images].every(i=>i.naturalWidth>0),anchors:[...toc.querySelectorAll('a')].every(a=>!!document.getElementById(decodeURIComponent(a.hash.slice(1))))}})()`);
  assert(state.scroll<=width);assert.equal(state.figures,9);assert.equal(state.tables,0);assert(state.imagesLoaded&&state.leadBeforeToc&&state.anchors);
  assert(state.diagramLabels.every(n=>n>=14&&n<=18.01));assert(state.diagramWidths.every(n=>n<=320.01));
  const doc=await b.send('DOM.getDocument'),fonts={};
  for(const sel of ['.article-lead>p','.article-body h2']){const q=await b.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:sel});fonts[sel]=(await b.send('CSS.getPlatformFontsForNode',{nodeId:q.nodeId})).fonts;}
  assert(fonts['.article-lead>p'].some(f=>/Zen.*Kaku/i.test(f.familyName)&&f.isCustomFont));assert(fonts['.article-body h2'].some(f=>/Noto.*Serif.*JP/i.test(f.familyName)&&f.isCustomFont));
  evidence.push({...state,fonts});
  const roofBox=await b.js('(()=>{const g=document.querySelectorAll(".article-diagrams")[2],r=g.getBoundingClientRect();return {x:Math.max(0,r.x-12),y:Math.max(0,r.y+scrollY-10),width:Math.min(innerWidth,r.width+24),height:r.height+20,scale:1}})()');
  const roofShot=await b.send('Page.captureScreenshot',{format:'png',clip:roofBox,captureBeyondViewport:true});await writeFile(join(out,'roof-comparison-'+width+'.png'),Buffer.from(roofShot.data,'base64'));

  const region=await b.js('(()=>{const r=document.querySelector(".article-diagrams").getBoundingClientRect();return {x:0,y:Math.max(0,r.y+scrollY-180),width:innerWidth,height:r.height+340,scale:1}})()');
  const detail=await b.send('Page.captureScreenshot',{format:'png',clip:region,captureBeyondViewport:true});await writeFile(join(out,'diagram-detail-'+width+'.png'),Buffer.from(detail.data,'base64'));

  const dim=await b.send('Page.getLayoutMetrics');const shot=await b.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:Math.ceil(dim.cssContentSize.height),scale:1},captureBeyondViewport:true});await writeFile(join(out,`preview-${width}.png`),Buffer.from(shot.data,'base64'));
 }
 await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await b.send('Emulation.setEmulatedMedia',{media:'screen'});await b.js('scrollTo(0,0)');await loaded(b,'.article-body h2');await pause(150);
 await b.js(`(()=>{const style=document.createElement('style');style.id='screen-pdf-page';style.textContent='@page{margin:0}';document.head.append(style);return true})()`);
 const dim=await b.send('Page.getLayoutMetrics');
 const common={printBackground:true,displayHeaderFooter:false,scale:1,preferCSSPageSize:false,generateTaggedPDF:true,generateDocumentOutline:true};
 const desktop=await b.send('Page.printToPDF',{...common,paperWidth:1440/96,paperHeight:(Math.ceil(dim.cssContentSize.height)+1)/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0});
 await writeFile(join(out,kind==='final-review'?'article-desktop.pdf':'review-body-desktop.pdf'),Buffer.from(desktop.data,'base64'));
 await b.js("document.getElementById('screen-pdf-page')?.remove()");
 await b.send('Emulation.setEmulatedMedia',{media:'print'});await b.js('document.fonts.ready.then(()=>true)');await pause(150);
 const a4=await b.send('Page.printToPDF',{...common,paperWidth:210/25.4,paperHeight:297/25.4,marginTop:10/25.4,marginBottom:10/25.4,marginLeft:10/25.4,marginRight:10/25.4});
 await writeFile(join(out,kind==='final-review'?'article-a4.pdf':'review-body-a4.pdf'),Buffer.from(a4.data,'base64'));
 await writeFile(join(out,'verification.json'),JSON.stringify({kind,bodyOnly:kind!=='final-review',heroFinal:kind==='final-review',productionEligible:false,identity:record.identity,browser:await b.send('Browser.getVersion'),evidence,official:record.official},null,2));
}finally{await b.close()}
let html=await readFile(join(record.output,record.route.replace(/^\//u,''),'index.html'),'utf8');
for(const m of [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]){
 const href=/href="([^"]+)"/.exec(m[0])?.[1];if(!href?.startsWith('/'))continue;
 let css=await readFile(join(record.output,href.slice(1)),'utf8');css=css.replace(/url\((['"]?)\/fonts\//g,'url($1https://xpotato.net/fonts/');html=html.replace(m[0],'<style>'+css+'</style>');
}
html=html.replace(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g,'');
for(const m of [...html.matchAll(/src="(\/[^\"]+)"/g)]){
 const src=m[1];if(src.startsWith('/__candidate_media/')||src.endsWith('.svg')){const bytes=await readFile(join(record.output,src.slice(1)));html=html.replace(m[0],'src="data:'+(src.endsWith('.svg')?'image/svg+xml':'image/png')+';base64,'+bytes.toString('base64')+'"');}else html=html.replace(m[0],'src="https://xpotato.net'+src+'"');
}
html=html.replaceAll('href="/','href="https://xpotato.net/');await writeFile(join(out,'article-review.html'),html);
const fixture=join(repo,'tests/fixtures/article-concrete');
const ids=record.identity.sources.filter(s=>s.kind==='original-labelled-svg').map(s=>s.asset);
for(const id of ids){await cp(join(base,id+'.png'),join(out,id+'.png'));await cp(join(fixture,id+'.svg'),join(out,id+'.svg'));}
for(const name of ['slicers.png','brand-strip.png','bambu-official.svg','cura-official.svg','cover.png'])await cp(join(base,name),join(out,name));
for(const name of ['article.mdx','editor-context.md','README.md'])await cp(join(fixture,name),join(out,name));
for(const skill of ['japanese-technical-blog','draft-japanese-technical-article','revise-article-from-audit','independent-article-audit','plan-article-visual','independent-visual-audit'])await cp(join(repo,'.agents/skills',skill),join(out,'skills',skill),{recursive:true});
console.log(JSON.stringify({export:out,kind,bodyOnly:kind!=='final-review',viewports:evidence.map(e=>e.viewport),labels:evidence.map(e=>e.diagramLabels),fontsDistributed:false}));
