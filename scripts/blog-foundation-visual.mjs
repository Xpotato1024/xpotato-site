import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {browserSession,loaded} from './article-concrete-browser.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),root=join(repo,'apps/site/.local/blog-public-projection/output'),out=join(repo,'.local/blog-design');
await mkdir(out,{recursive:true});
assert((await readFile(join(root,'.private-draft-preview'),'utf8')).includes('productionEligible=false'));
const expected=JSON.parse(await readFile(join(root,'__fixture-social.json'),'utf8'));
assert.equal(createHash('sha256').update(await readFile(join(root,'__fixture-social.png'))).digest('hex'),expected.sha256);
const browser=await browserSession(root,'/blog/sample/'),evidence=[];
const require=createRequire(import.meta.url),axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
try{
 for(const route of ['/blog/sample/','/blog/category/robotics/','/blog/tag/rust/','/blog/noindex/','/blog/fdm-strength-settings/']){
  await browser.send('Page.navigate',{url:browser.origin+route});await loaded(browser,'main');
  for(const {width,textScale} of [1440,390,320].flatMap(width=>(route==='/blog/fdm-strength-settings/'?[1,2]:[1]).map(textScale=>({width,textScale})))){
   await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await loaded(browser,'main');
   await browser.js(`document.documentElement.style.fontSize=${JSON.stringify(textScale===2?'200%':'100%')}`);
   const data=await browser.js(`(()=>{const json=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)),bc=json.find(x=>x['@type']==='BreadcrumbList'),article=json.find(x=>x['@type']==='BlogPosting'),meta=n=>document.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]')?.content;return {width:innerWidth,scroll:document.documentElement.scrollWidth,canonical:document.querySelector('link[rel="canonical"]').href,ogUrl:meta('og:url'),heading:document.querySelector('h1').textContent,seoTitle:meta('og:title'),twitterTitle:meta('twitter:title'),imageAlt:meta('og:image:alt'),twitterAlt:meta('twitter:image:alt'),image:meta('og:image'),twitter:meta('twitter:image'),card:meta('twitter:card'),noindex:meta('robots'),article,bc,visibleCrumbs:[...document.querySelectorAll('nav[aria-label="パンくず"] li')].map(li=>li.firstElementChild.textContent),tagHrefs:[...document.querySelectorAll('.related-tags a')].map(a=>a.getAttribute('href')),metadataOnly:[...document.querySelectorAll('.related-tags li')].find(li=>li.textContent==='属性のみ')?.querySelector('a')===null,links:[...document.querySelectorAll('a[href^="/blog/"]')].map(a=>a.getAttribute('href'))}})()`);
   assert(data.scroll<=width,'horizontal overflow '+route+' '+width);
   if(route==='/blog/sample/'){
    assert.equal(data.heading,expected.title);assert.equal(data.seoTitle,expected.seoTitle);assert.equal(data.twitterTitle,expected.seoTitle);assert(!data.seoTitle.includes('\n'));assert.equal(data.image,expected.url);assert.equal(data.imageAlt,expected.alt);assert.equal(data.twitterAlt,expected.alt);
    assert.equal(data.canonical,'https://xpotato.net/blog/canonical-target/');assert.equal(data.ogUrl,data.canonical);assert.equal(data.article.url,data.canonical);
    assert.equal(data.bc.itemListElement.at(-1).item,data.canonical);assert.deepEqual(data.bc.itemListElement.map(x=>x.name),data.visibleCrumbs);
    assert.equal(data.visibleCrumbs.length,5);assert.equal(data.image,data.twitter);assert.match(data.image,/^https:\/\//);assert.equal(data.card,'summary_large_image');assert(data.metadataOnly);assert.deepEqual(data.tagHrefs,['/blog/tag/rust/']);
   }
   if(route==='/blog/noindex/'){assert.equal(data.noindex,'noindex');assert(!data.article&&!data.bc);assert.equal(data.tagHrefs.length,0);}
   if(route==='/blog/fdm-strength-settings/'){
    assert.deepEqual(data.visibleCrumbs,['Articles','工作','3Dプリンタ',data.heading]);
    assert.deepEqual(data.tagHrefs,['/blog/tag/fdm/','/blog/tag/design/','/blog/tag/troubleshooting/']);
    const groups=await browser.js(`[...document.querySelectorAll('.related-tags')].map(g=>({kind:g.dataset.tagKind,text:g.textContent.replace(/\\s+/g,' ').trim()}))`);
    assert.deepEqual(groups.map(g=>g.kind),['technology','purpose']);
    assert.match(groups[0].text,/技術タグ.*FDM\/FFF/u);assert.match(groups[1].text,/記事の目的.*設計.*トラブルシューティング/u);
    assert.deepEqual(data.bc.itemListElement.map(x=>x.name),data.visibleCrumbs);
   }
   for(const href of data.links)await access(join(root,decodeURIComponent(href),'index.html'));
   await browser.js(axe);const a11y=await browser.js(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact})))`);assert.equal(a11y.length,0,JSON.stringify(a11y));
   const metrics=await browser.send('Page.getLayoutMetrics');const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:Math.min(5000,Math.ceil(metrics.cssContentSize.height)),scale:1},captureBeyondViewport:true});
   await writeFile(join(out,route.split('/').filter(Boolean).join('-')+'-'+width+(textScale===2?'-text200':'')+'.png'),Buffer.from(shot.data,'base64'));
   if(route==='/blog/sample/'){
    const header=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:Math.min(1100,Math.ceil(metrics.cssContentSize.height)),scale:1},captureBeyondViewport:true});await writeFile(join(out,'blog-header-'+width+'.png'),Buffer.from(header.data,'base64'));
   }
   evidence.push({route,width,textScale,canonical:data.canonical,crumbs:data.visibleCrumbs,tagHrefs:data.tagHrefs,image:data.image,a11y});
  }
 }
 for(const slug of ['robotics','electronics','boards'])await access(join(root,'blog/category',slug,'page/2/index.html'));
 await assert.rejects(access(join(root,'blog/held/index.html')));
 await writeFile(join(out,'blog-verification.json'),JSON.stringify({productionEligible:false,scope:'synthetic projection of real templates; not publication readiness',browser:await browser.send('Browser.getVersion'),evidence},null,2));
}finally{await browser.close()}
const cards=await browserSession(out,'/index.html');
try{
 for(const width of [1440,390,320]){
  await cards.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await loaded(cards,'img');
  assert(await cards.js('document.documentElement.scrollWidth<=innerWidth'),'card comparison horizontal overflow');
  const metrics=await cards.send('Page.getLayoutMetrics');const shot=await cards.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1},captureBeyondViewport:true});await writeFile(join(out,'comparison-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
}finally{await cards.close()}
console.log('Blog templates, metadata, archive links, 18 viewport/text conditions and card comparison verified:',out);
