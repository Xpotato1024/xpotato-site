import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {browserSession,loaded} from './article-concrete-browser.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'.local/blog-design');
const logo=await readFile(join(root,'apps/site/public/xpotato-logo.svg'),'utf8');
const fonts=await readFile(join(root,'apps/site/src/styles/fonts.css'),'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const titles=[
 '充填率100%なら丈夫になる？ 壊れ方で選ぶ設定',
 '3Dプリンタでフックの根元が折れるとき、外周・インフィル・上面の厚さ・積層方向をどう切り分けるか：実測していない比較例と、設定だけでは解決しない形状の限界',
];
function card(variant,title){
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><title>SNSカード比較 ${variant}</title><style>${fonts}
 *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#faf9f7;color:#15141d;font-synthesis:none}.card{position:relative;width:1200px;height:630px;border:1px solid #d8d4dc;display:flex;align-items:center;flex-direction:column;padding:65px 0 55px}.brand{height:60px;display:flex;align-items:center;gap:16px;font:500 28px "Zen Kaku Gothic New"}.brand svg{width:68px;height:48px}.category{font:500 22px "Zen Kaku Gothic New";color:#745399;margin-top:20px;max-width:540px;white-space:normal;text-align:center}h1{font:400 54px/1.3 "Noto Serif JP";letter-spacing:-.025em;margin:26px 0 0;width:540px;max-height:282px;text-align:center;overflow-wrap:anywhere;line-break:strict}.footer{position:absolute;bottom:53px;font:400 20px "Zen Kaku Gothic New";letter-spacing:.08em;color:#625e6e}.a{border-left:160px solid #745399;border-right:160px solid #745399}.b{background:#745399}.b:before{content:"";position:absolute;inset:34px 260px;background:#faf9f7;border-radius:12px}.b>*{z-index:1}.b h1{font-family:"Zen Kaku Gothic New";font-weight:500}.c{border-top:22px solid #745399;border-bottom:22px solid #745399;padding-top:43px}.c:after{content:"";width:80px;height:3px;background:#745399;position:absolute;bottom:99px}.c .footer{bottom:31px}
 </style><article class="card ${variant}" data-variant="${variant}"><div class="brand">${logo}<span>Xpotato.net</span></div><div class="category">工作 / 3Dプリンタ</div><h1>${escape(title)}</h1><div class="footer">技術とものづくりの記録</div></article></html>`;
}
await mkdir(out,{recursive:true});
const virtual={},records=[];
for(const variant of ['a','b','c'])for(let i=0;i<titles.length;i++){const name=`card-${variant}-${i}`,html=card(variant,titles[i]).replace('54px/1.3','54px/1.25').replace('max-height:282px','max-height:320px');virtual['/'+name]=html;}
const browser=await browserSession(join(root,'apps/site/public'),'/card-a-0',virtual);
try{
 await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
 for(const [path,html]of Object.entries(virtual)){
  await browser.send('Page.navigate',{url:browser.origin+path});await loaded(browser,'h1');
  const result=await browser.js(`(()=>{const e=document.querySelector('h1');e.style.maxHeight='320px';e.style.lineHeight='1.25';let size=54;while(size>36 && e.scrollHeight>320){size-=2;e.style.fontSize=size+'px'}return {title:e.textContent,size,height:e.scrollHeight,fit:e.scrollHeight<=320,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))}})()`);
  if(!result.fit)throw Error('Title does not fit; editorial revision required: '+path);
  const renderedHtml=html.replace('<h1>','<h1 style="font-size:'+result.size+'px">');
  await writeFile(join(out,path.slice(1)+'.html'),renderedHtml);
  const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1200,height:630,scale:1},captureBeyondViewport:true});
  await writeFile(join(out,path.slice(1)+'.png'),Buffer.from(shot.data,'base64'));
  const square=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:285,y:0,width:630,height:630,scale:1},captureBeyondViewport:true});
  await writeFile(join(out,path.slice(1)+'-square.png'),Buffer.from(square.data,'base64'));
  records.push({path,...result,sourceSha256:createHash('sha256').update(renderedHtml).digest('hex')});
 }
 const summary=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Xpotato.net SNSカード比較</title><style>body{margin:32px;background:#f0edf3;color:#15141d;font:16px system-ui}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}figcaption{padding:8px 0}p{max-width:70ch;line-height:1.7}</style><h1>Xpotato.net SNSカード比較・未採用</h1><p>既存XPロゴと紫 #745399 を使用。A: 両端の紫、B: 紫と白い本文面、C: 上下の紫。各案の上段は通常見出し、下段は長い見出し。中央630pxの正方形cropでも見出しを残します。</p><div class="grid">${['a','b','c'].map((v,i)=>`<figure><img src="card-${v}-0.png"><img src="card-${v}-1.png"><figcaption>${['A：余白と紫の柱','B：紫の面と角丸の紙面','C：上下の帯とセリフ見出し'][i]}</figcaption></figure>`).join('')}</div>`;
 await writeFile(join(out,'index.html'),summary.replace('margin:32px','margin:clamp(12px,4vw,32px)').replace('minmax(280px,1fr)','minmax(min(100%,280px),1fr)'));
 for(const variant of ['a','b','c'])for(let i=0;i<titles.length;i++){
  const bytes=await readFile(join(out,`card-${variant}-${i}.png`));
  const path=`/thumb-${variant}-${i}`;virtual[path]=`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}img{display:block;width:320px;height:168px}</style><img src="data:image/png;base64,${bytes.toString('base64')}">`;
  await browser.send('Emulation.setDeviceMetricsOverride',{width:320,height:168,deviceScaleFactor:1,mobile:true});await browser.send('Page.navigate',{url:browser.origin+path});await loaded(browser,'img');
  const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:320,height:168,scale:1}});await writeFile(join(out,`card-${variant}-${i}-320.png`),Buffer.from(shot.data,'base64'));
 }
 await writeFile(join(out,'verification.json'),JSON.stringify({productionEligible:false,classification:'unadopted example only',browser:await browser.send('Browser.getVersion'),records},null,2));
}finally{await browser.close()}
console.log(out);
