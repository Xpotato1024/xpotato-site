// Actual private Site preview QA. Never imports or publishes the fixture.
import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';
import {browserSession,loaded} from './article-concrete-browser.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),base=join(repo,'.local/article-concrete'),p=JSON.parse(await readFile(join(base,'preview.json'),'utf8'));
assert.equal(p.productionEligible,false);
const output=process.platform==='win32'?p.output.replace(/^\/mnt\/([a-z])\//u,(_,drive)=>drive.toUpperCase()+':/'):p.output;
assert.ok(relative(repo,resolve(output)).replaceAll('\\','/').startsWith('apps/site/.local/article-candidate-builds/'));
const out=join(base,'qa');await mkdir(out,{recursive:true});const b=await browserSession(output,p.route),rows=[];
try{
 await loaded(b,'.article-body h2');
 const metadata=await b.js(`(()=>{const meta=s=>document.querySelector(s)?.content??null;return {h1:document.querySelector('h1')?.textContent,title:document.title,robots:meta('meta[name="robots"]'),private:meta('meta[name="xpotato-private-draft-preview-v1"]'),canonical:document.querySelector('link[rel="canonical"]')?.href,og:meta('meta[property="og:image"]'),twitter:meta('meta[name="twitter:image"]'),imageAlt:meta('meta[property="og:image:alt"]'),notice:document.querySelector('.candidate-preview-notice')?.textContent,jsonLd:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)),images:[...document.images].map(i=>({url:i.src,alt:i.alt,width:i.naturalWidth}))}})()`);
 assert.equal(metadata.robots,'noindex');assert.match(metadata.private,/productionEligible=false/u);assert.match(metadata.notice,/未公開・未承認/u);
 assert.equal(metadata.canonical,'https://xpotato.net'+p.route);assert.equal(metadata.twitter,null,'noindex preview must not advertise a Twitter image');
 assert.equal(metadata.h1,p.identity.social.binding.layout.title);assert.ok(metadata.title.startsWith(metadata.h1+' | '),'display wrapping must not enter the canonical title');
 assert.equal(metadata.og,'https://assets.xpotato.net/media/v1/objects/sha256/'+p.identity.social.sha256.slice(0,2)+'/'+p.identity.social.sha256+'.png');assert.ok(metadata.imageAlt?.length);
 assert.ok(metadata.images.every(i=>i.url.startsWith(b.origin+'/')&&i.width>0&&(i.alt||new URL(i.url).pathname==='/xpotato-logo.svg')),'content images need alt; logo is decorative beside the wordmark');
 const axe=await readFile(join(repo,'node_modules/axe-core/axe.min.js'),'utf8');
 for(const width of [1440,390,320])for(const textScale of [1,2]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await b.js('document.documentElement.style.fontSize='+JSON.stringify(textScale*100+'%'));await loaded(b,'.article-body h2');await b.js('scrollTo(0,0)');
  const layout=await b.js(`(()=>{const toc=document.querySelector('.table-of-contents');return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,figures:document.querySelectorAll('.prose figure').length,anchors:[...toc.querySelectorAll('a')].every(a=>!!document.getElementById(decodeURIComponent(a.hash.slice(1))))}})()`);
  assert.ok(layout.scroll<=width+1,JSON.stringify(layout));assert.equal(layout.figures,9);assert.ok(layout.anchors);
  await b.js(axe);const accessibility=await b.js("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>v.id)}))");
  assert.deepEqual(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
  const shot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),file='page-'+width+'-'+textScale+'.png';await writeFile(join(out,file),Buffer.from(shot.data,'base64'));
  rows.push({width,textScale,...layout,accessibility,screenshot:file,physicalMobile:false});
 }
 const report={status:'PASS',productionEligible:false,heroState:p.heroState,mdxSha256:p.identity.mdxSha256,socialSha256:p.identity.social.sha256,metadata,rows,browser:await b.send('Browser.getVersion')};
 await writeFile(join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,heroState:p.heroState,viewports:rows.length,productionEligible:false}));
}finally{await b.close();}
