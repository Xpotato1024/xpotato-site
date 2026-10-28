import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {contentMediaRegistrySchema} from '@xpotato/content-contracts';import {buildPrivateCandidateAstro} from '../packages/article-pipeline/src/candidate-astro.js';
// Fixture-only rendering helper; never writes canonical content or publishes media.
// @ts-ignore Plain JS uses the browser CDP without a new dependency.
import {browserSession,loaded} from './article-concrete-browser.mjs';
// @ts-ignore Plain-JS preview state validator.
import {previewHeroOptions} from './article-preview-state.mjs';
const {heroPath,compositionOnly}=previewHeroOptions(process.argv.slice(2),process.env);
const repo=fileURLToPath(new URL('../',import.meta.url)),fixture=join(repo,'tests/fixtures/article-concrete'),out=join(repo,'.local/article-concrete');await mkdir(out,{recursive:true});
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');const sharp=createRequire(new URL('../apps/site/package.json',import.meta.url))('sharp');
const fonts=(await readFile(join(repo,'apps/site/src/styles/fonts.css'),'utf8'))+(await readFile(join(repo,'apps/site/src/styles/fonts-core.css'),'utf8'));
const official={bambu:'https://raw.githubusercontent.com/bambulab/BambuStudio/79df7ae309be398ed30c9f397c13c9911c2edc57/resources/images/BambuStudio.svg',cura:'https://raw.githubusercontent.com/Ultimaker/Cura/7644eaeff91dfedfb464e2b4e2b3086451262259/packaging/icons/cura-icon.svg'};
const logos:Record<string,string>={};for(const[k,u]of Object.entries(official)){const r=await fetch(u);if(!r.ok)throw Error('Source retrieval failed '+r.status);logos[k]=await r.text();await writeFile(join(out,k+'-official.svg'),logos[k]);}
const page=(body:string,w=320)=>'<html lang="ja"><meta charset="utf-8"><style>'+fonts+'html,body{margin:0;padding:0;width:'+w+'px;background:#faf9f7;font-synthesis:none;font-family:"Zen Kaku Gothic New",sans-serif;}svg{display:block}img{display:block}</style>'+body+'</html>';
const ids=["walls-a","walls-b","walls-c","orientation-a","orientation-b","roof-a","roof-b"];const virtual:Record<string,string>={};for(const id of ids)virtual['/diagram-'+id]=page(await readFile(join(fixture,id+'.svg'),'utf8'));
virtual['/brand-strip']=page('<div style="height:72px;display:flex;align-items:center;justify-content:center;gap:8px;background:#faf9f7"><div style="display:flex;align-items:center;gap:8px"><img width="36" height="36" src="data:image/svg+xml;base64,'+Buffer.from(logos.bambu!).toString('base64')+'"><span style="font-size:16px">Bambu Studio</span></div><div style="display:flex;align-items:center;gap:8px"><img width="36" height="36" src="data:image/svg+xml;base64,'+Buffer.from(logos.cura!).toString('base64')+'"><span style="font-size:16px">UltiMaker Cura</span></div></div>',360);
const browser=await browserSession(join(repo,'apps/site/public'),'/diagram-walls',virtual);const records:any[]=[],objects:any[]=[],sources:any[]=[];const contentId='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8';
try{for(const id of [...ids,'brand-strip']){await browser.send('Emulation.setDeviceMetricsOverride',{width:id==='brand-strip'?360:320,height:1200,deviceScaleFactor:2,mobile:false});await browser.send('Page.navigate',{url:browser.origin+(id==='brand-strip'?'/brand-strip':'/diagram-'+id)});for(let n=0;n<120;n++){if(await browser.js('location.pathname==='+JSON.stringify(id==='brand-strip'?'/brand-strip':'/diagram-'+id)))break;await new Promise(r=>setTimeout(r,100))}await loaded(browser,id==='brand-strip'?'div':'svg text');
 const doc=await browser.send('DOM.getDocument');const node=await browser.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:id==='brand-strip'?'span':'svg text'});const ff=(await browser.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})).fonts;if(!ff.some((f:any)=>/Zen.*Kaku/i.test(f.familyName)&&f.isCustomFont))throw Error('Actual selected diagram font missing '+id);
 const box=await browser.js('(()=>{const r=document.querySelector('+JSON.stringify(id==='brand-strip'?'body>div':'svg')+').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
 const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:box,captureBeyondViewport:true});const bytes=Buffer.from(shot.data,'base64');await writeFile(join(out,id+'.png'),bytes);sources.push({asset:id,kind:id==='brand-strip'?'official-identification-composite':'original-labelled-svg',sourceSha256:id==='brand-strip'?hash(JSON.stringify(official)):hash(await readFile(join(fixture,id+'.svg'))),font:ff.map((f:any)=>f.familyName)});
 }}finally{await browser.close()}
await cp(join(out,'brand-strip.png'),join(out,'slicers.png'));
// Final exports require a supplied local hero. Empty slots are explicit composition-only fixtures.
let heroBytes:Buffer,heroSourceSha256:string|null=null;
if(heroPath){
 const input=await readFile(heroPath);if(input.length>24*1024*1024)throw Error('PREVIEW_HERO_TOO_LARGE');
 const metadata=await sharp(input).metadata();
 if(!metadata.width||!metadata.height||Math.abs(metadata.width/metadata.height-16/9)>0.01)throw Error('PREVIEW_HERO_MUST_BE_16_9');
 heroBytes=await sharp(input).rotate().resize(1200,675,{fit:'fill'}).png().toBuffer();heroSourceSha256=hash(input);
}else heroBytes=await sharp({create:{width:1200,height:675,channels:3,background:'#eadfe8'}}).png().toBuffer();
await writeFile(join(out,'cover.png'),heroBytes);
const heroState=compositionOnly?'internal-composition-slot-not-final':'provided-hero';
for(const id of ['cover',...ids,'slicers']){const bytes=await readFile(join(out,id+'.png')),meta=await sharp(bytes).metadata(),sha=hash(bytes);records.push({assetId:id,role:id==='cover'?'hero':'inline',origin:id==='cover'&&!compositionOnly?'ai_generated':'diagram',defaultAlt:id==='cover'?'3Dプリンタの設定と部品を紹介する生成イメージ':id,delivery:{mode:'fixed',master:{sha256:sha,objectKey:'media/v1/objects/sha256/'+sha.slice(0,2)+'/'+sha+'.png',format:'png',width:meta.width,height:meta.height,sizeBytes:bytes.length},variants:[]},provenanceRef:'article-concrete-review-fixture',rightsRef:'original-review-not-approved',status:'active'});objects.push({sha256:sha,path:id+'.png',contentType:'image/png'})}
const mdx=await readFile(join(fixture,'article.mdx'),'utf8'),identity={mdxSha256:hash(mdx),sources,hero:{sha256:hash(heroBytes),sourceSha256:heroSourceSha256,state:heroState}};
const built=await buildPrivateCandidateAstro({repositoryRoot:repo,contentId,route:'/blog/article-infill-concrete/',mdx,candidateInputSha256:hash(JSON.stringify(identity)),scope:'synthetic_fixture',reference:true,planConfirmed:false,plannedSeo:{canonical:'https://xpotato.net/blog/article-infill-concrete/',image:null},mediaFolder:out,media:{registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId,assets:records}),localObjects:objects}});
await writeFile(join(out,'preview.json'),JSON.stringify({root:built.root,output:built.output,route:'/blog/article-infill-concrete/',productionEligible:false,heroState,identity,official,heroSha256:hash(heroBytes),files:built.files},null,2));console.log(JSON.stringify({output:built.output,identity,heroState},null,2));
