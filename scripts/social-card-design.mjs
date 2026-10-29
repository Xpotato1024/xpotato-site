import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {browserSession,loaded} from './article-concrete-browser.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'.local/blog-design');
const logo=await readFile(join(root,'apps/site/public/xpotato-logo.svg'),'utf8');
const fonts=await readFile(join(root,'apps/site/src/styles/fonts.css'),'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const {cases}=JSON.parse(await readFile(join(root,'tests/fixtures/blog-foundation/social-card-titles.json'),'utf8'));
const layoutSource=(await readFile(join(root,'packages/content-contracts/src/social-title-layout.mjs'),'utf8')).replace(/^export /gm,'');
const titles=cases.map(item=>item.title);
function card(variant,title){
 return `<!doctype html><html lang="ja"><meta charset="utf-8"><title>SNSカード比較 ${variant}</title><style>${fonts}
 *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#faf9f7;color:#15141d;font-synthesis:none}.card{position:relative;width:1200px;height:630px;border:1px solid #d8d4dc;display:flex;align-items:center;flex-direction:column;padding:65px 0 55px}.brand{height:60px;display:flex;align-items:center;gap:16px;font:500 28px "Zen Kaku Gothic New"}.brand svg{width:68px;height:48px}.category{font:500 22px "Zen Kaku Gothic New";color:#745399;margin-top:20px;max-width:540px;white-space:normal;text-align:center}h1{font:400 54px/1.3 "Noto Serif JP";letter-spacing:-.025em;margin:26px 0 0;width:540px;max-height:282px;text-align:center;overflow-wrap:anywhere;line-break:strict}.footer{position:absolute;bottom:53px;font:400 20px "Zen Kaku Gothic New";letter-spacing:.08em;color:#625e6e}.a{border-left:160px solid #745399;border-right:160px solid #745399}.b{background:#745399}.b:before{content:"";position:absolute;inset:34px 260px;background:#faf9f7;border-radius:12px}.b>*{z-index:1}.b h1{font-family:"Zen Kaku Gothic New";font-weight:500}.c{border-top:22px solid #745399;border-bottom:22px solid #745399;padding-top:43px}.c:after{content:"";width:80px;height:3px;background:#745399;position:absolute;bottom:99px}.c .footer{bottom:31px}
 h1{letter-spacing:normal;max-height:320px;overflow:visible}.card-title-line{display:block;white-space:pre}
 </style><article class="card ${variant}" data-variant="${variant}"><div class="brand">${logo}<span>Xpotato.net</span></div><div class="category">工作 / 3Dプリンタ</div><h1 aria-label="${escape(title)}">${escape(title)}</h1><div class="footer">技術とものづくりの記録</div></article></html>`;
}
await mkdir(out,{recursive:true});
const virtual={},records=[];
for(const variant of ['a','b','c'])for(let i=0;i<titles.length;i++){const name=`card-${variant}-${i}`,html=card(variant,titles[i]).replace('54px/1.3','54px/1.25').replace('max-height:282px','max-height:320px');virtual['/'+name]=html;}
const browser=await browserSession(join(root,'apps/site/public'),'/card-a-0',virtual);
try{
 await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
 for(const [path,html]of Object.entries(virtual)){
  await browser.send('Page.navigate',{url:browser.origin+path});await loaded(browser,'h1');
  const item=cases[Number(path.split('-').at(-1))];
  const result=await browser.js(`(()=>{${layoutSource}\nconst e=document.querySelector('h1'),style=getComputedStyle(e),ctx=document.createElement('canvas').getContext('2d');const measure=(text,size)=>{ctx.font=style.fontWeight+' '+size+'px '+style.fontFamily;return ctx.measureText(text).width};let layout;try{layout=layoutSocialTitle(${JSON.stringify(item.title)},${JSON.stringify(item.cardDisplay??{})},measure)}catch(error){return {error:error.message}}e.style.fontSize=layout.fontSize+'px';e.style.lineHeight=String(layout.lineHeight);e.replaceChildren(...layout.lines.map(line=>{const span=document.createElement('span');span.className='card-title-line';span.textContent=line;return span}));const widths=[...e.children].map(span=>{const range=document.createRange();range.selectNodeContents(span);return range.getBoundingClientRect().width});return {...layout,size:layout.fontSize,widths,height:e.scrollHeight,fit:e.scrollHeight<=320&&widths.every(w=>w<=540.5),footerGap:document.querySelector('.footer').getBoundingClientRect().top-e.getBoundingClientRect().bottom,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect())),unsafeChildren:!!e.querySelector('script,img,iframe')}})()`);
  if(item.expectedError){if(result.error!==item.expectedError)throw Error('Expected capacity rejection: '+path+' '+JSON.stringify(result));records.push({path,caseId:item.id,status:'rejected',error:result.error});continue;}
  if(result.error||!result.fit||result.footerGap<12||result.unsafeChildren)throw Error('Title layout failed: '+path+' '+JSON.stringify(result));
  const lines=result.lines.map(line=>`<span class="card-title-line">${escape(line)}</span>`).join('');
  const renderedHtml=html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/u,()=>`<h1 aria-label="${escape(item.title)}" style="font-size:${result.fontSize}px;line-height:${result.lineHeight}">${lines}</h1>`);
  await writeFile(join(out,path.slice(1)+'.html'),renderedHtml);
  // Reopen the exact saved bytes as well as checking the textContent-based live composition.
  virtual[path]=await readFile(join(out,path.slice(1)+'.html'),'utf8');
  await browser.send('Page.navigate',{url:browser.origin+path+'?saved=1'});await loaded(browser,'.card-title-line');
  const saved=await browser.js(`(()=>({url:location.search,title:document.querySelector('h1').getAttribute('aria-label'),lines:[...document.querySelectorAll('h1 .card-title-line')].map(s=>s.textContent),headings:document.querySelectorAll('h1').length,unsafe:!!document.querySelector('h1 script,h1 img,h1 iframe')}))()`);
  if(saved.url!=='?saved=1'||saved.title!==item.title||JSON.stringify(saved.lines)!==JSON.stringify(result.lines)||saved.headings!==1||saved.unsafe)throw Error('Saved title HTML mismatch: '+path);
  const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1200,height:630,scale:1},captureBeyondViewport:true});
  await writeFile(join(out,path.slice(1)+'.png'),Buffer.from(shot.data,'base64'));
  const square=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:285,y:0,width:630,height:630,scale:1},captureBeyondViewport:true});
  await writeFile(join(out,path.slice(1)+'-square.png'),Buffer.from(square.data,'base64'));
  records.push({path,caseId:item.id,status:'rendered',...result,savedHtmlVerified:true,sourceSha256:createHash('sha256').update(renderedHtml).digest('hex')});
 }
 const summary=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Xpotato.net SNSカード比較</title><style>body{margin:32px;background:#f0edf3;color:#15141d;font:16px system-ui}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}figcaption{padding:8px 0}p{max-width:70ch;line-height:1.7}</style><h1>Xpotato.net SNSカード比較・未採用</h1><p>既存XPロゴと紫 #745399 を使用。A: 両端の紫、B: 紫と白い本文面、C: 上下の紫。各案の上段は通常見出し、下段は長い見出し。中央630pxの正方形cropでも見出しを残します。</p><div class="grid">${['a','b','c'].map((v,i)=>`<figure><img src="card-${v}-0.png"><img src="card-${v}-1.png"><figcaption>${['A：余白と紫の柱','B：紫の面と角丸の紙面','C：上下の帯とセリフ見出し'][i]}</figcaption></figure>`).join('')}</div>`;
 await writeFile(join(out,'index.html'),summary.replace('margin:32px','margin:clamp(12px,4vw,32px)').replace('minmax(280px,1fr)','minmax(min(100%,280px),1fr)'));
 for(const record of records.filter(record=>record.status==='rendered')){const [,variant,index]=record.path.slice(1).split('-'),i=Number(index);
  const bytes=await readFile(join(out,`card-${variant}-${i}.png`));
  const path=`/thumb-${variant}-${i}`;virtual[path]=`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}img{display:block;width:320px;height:168px}</style><img src="data:image/png;base64,${bytes.toString('base64')}">`;
  await browser.send('Emulation.setDeviceMetricsOverride',{width:320,height:168,deviceScaleFactor:1,mobile:true});await browser.send('Page.navigate',{url:browser.origin+path});await loaded(browser,'img');
  const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:320,height:168,scale:1}});await writeFile(join(out,`card-${variant}-${i}-320.png`),Buffer.from(shot.data,'base64'));
 }
 await writeFile(join(out,'verification.json'),JSON.stringify({productionEligible:false,classification:'unadopted example only',browser:await browser.send('Browser.getVersion'),records},null,2));
}finally{await browser.close()}
console.log(out);
