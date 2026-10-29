import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {browserSession,loaded} from './article-concrete-browser.mjs';
const root=resolve('.local/blog-design/selected-c'),report=JSON.parse(await readFile(join(root,'verification.json'),'utf8')),virtual={};
const records=report.records.map((r,i)=>({...r,index:i})).filter(r=>r.status==='rendered');
for(const r of records)virtual['/case-'+r.index]='<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}img{display:block;width:100vw;height:auto}</style><img src="/card-'+r.index+'.png" alt="C standard">';
const browser=await browserSession(root,'/case-0',virtual),observations=[];
try{
 for(const r of records)for(const width of [1200,320]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:width===1200?630:168,deviceScaleFactor:1,mobile:width<600});
  await browser.send('Page.navigate',{url:browser.origin+'/case-'+r.index});await loaded(browser,'img');
  const m=await browser.js('(()=>{const e=document.querySelector("img");return {width:e.naturalWidth,height:e.naturalHeight,scroll:document.documentElement.scrollWidth,client:innerWidth,display:e.getBoundingClientRect().toJSON()}})()');
  assert.equal(m.width,1200);assert.equal(m.height,630);assert(m.scroll<=width);
  const s=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:width===1200?630:168,scale:1}});
  await writeFile(join(root,(width===1200?'wide-':'thumb-')+r.index+'.png'),Buffer.from(s.data,'base64'));
  if(width===1200){const square=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:285,y:0,width:630,height:630,scale:1}});await writeFile(join(root,'square-'+r.index+'.png'),Buffer.from(square.data,'base64'));}
  observations.push({id:r.id,width,...m});
 }
 virtual['/sheet']='<!doctype html><meta charset="utf-8"><style>body{margin:20px;background:#f0edf3;color:#15141d;font:15px system-ui;width:1000px}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(3,320px);gap:20px}figure{margin:0}img{width:320px;height:168px}</style><h1>C採用・320px実寸検証</h1><p>既存＋新規タイトル。公開記事・分類の採用とは別です。</p><div class="grid">'+records.map(r=>'<figure><figcaption>'+r.id+'</figcaption><img src="/card-'+r.index+'.png"></figure>').join('')+'</div>';
 await browser.send('Emulation.setDeviceMetricsOverride',{width:1040,height:1000,deviceScaleFactor:1,mobile:false});
 await browser.send('Page.navigate',{url:browser.origin+'/sheet'});await loaded(browser,'img');
 const metrics=await browser.send('Page.getLayoutMetrics'),shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1040,height:Math.ceil(metrics.cssContentSize.height),scale:1},captureBeyondViewport:true});
 await writeFile(join(root,'thumbnail-sheet.png'),Buffer.from(shot.data,'base64'));
 await writeFile(join(root,'viewport-verification.json'),JSON.stringify({productionEligible:false,designSelected:true,browser:await browser.send('Browser.getVersion'),observations},null,2));
}finally{await browser.close()}
console.log(JSON.stringify({rendered:records.length,viewports:observations.length}));
