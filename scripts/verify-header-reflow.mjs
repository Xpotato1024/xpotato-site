// Optional local browser regression; use a separately installed, pinned playwright-core.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseStaticHeaderRules,headersForPath} from './static-headers.mjs';
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const root=resolve(import.meta.dirname,'..'),dist=resolve(arg('--dist')??resolve(root,'apps/site/dist')),out=arg('--out');
if(!out||!process.env.PLAYWRIGHT_MODULE)throw Error('--out and separately pinned PLAYWRIGHT_MODULE required');
await mkdir(dirname(resolve(out)),{recursive:true});
const pw=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)));
const rules=parseStaticHeaderRules(await readFile(resolve(dist,'_headers'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const route=new URL(req.url,'http://localhost').pathname;let file=resolve(dist,'.'+decodeURIComponent(route));
 assert.ok(file===dist||file.startsWith(dist+sep));if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 let body=await readFile(file);
 if(route==='/tools/prime-factorizer/')body=String(body).replace(/<astro-island\b[\s\S]*?<\/astro-island>/gu,'<div data-header-test-placeholder></div>').replace(/<script\b[\s\S]*?<\/script>/gu,tag=>tag.includes('src="/scripts/mobile-menu.js"')?tag:'');
 res.writeHead(200,{...headersForPath(route,rules),'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(body);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const report={checkedAt:new Date().toISOString(),scope:'built Site header HTML/CSS/script; interactive content islands excluded in private harness; desktop engines and text resize',physicalIOS:false,screenReader:false,engines:[]};
const measure=()=>{const d=document.documentElement,h=document.querySelector('.site-header'),b=document.querySelector('.brand'),n=document.querySelector('.mobile-navigation'),rect=x=>{const r=x.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{viewport:innerWidth,documentClient:d.clientWidth,documentScroll:d.scrollWidth,headerClient:h.clientWidth,headerScroll:h.scrollWidth,header:rect(h),brand:rect(b),nav:rect(n),brandFont:parseFloat(getComputedStyle(b.querySelector('span')).fontSize),rootOverflow:getComputedStyle(d).overflowX,bodyOverflow:getComputedStyle(document.body).overflowX,scale:visualViewport?.scale};};
const assertBounds=m=>{assert.ok(m.documentScroll<=m.documentClient+1,JSON.stringify(m));assert.ok(m.headerScroll<=m.headerClient+1,JSON.stringify(m));assert.ok(m.brand.right<=m.nav.left+1||m.brand.bottom<=m.nav.top+1,JSON.stringify(m));assert.ok(!['hidden','clip'].includes(m.rootOverflow));assert.ok(!['hidden','clip'].includes(m.bodyOverflow));};
try{for(const name of ['firefox','webkit']){
 const browser=await pw[name].launch({headless:true}),result={name,version:browser.version(),cases:[],errors:[]};report.engines.push(result);
 try{const page=await browser.newPage({viewport:{width:393,height:844}});page.setDefaultTimeout(8000);page.on('pageerror',e=>result.errors.push(String(e)));
 const control=await browser.newPage();await control.setContent('<a id="a" href="#x">A</a><a id="b" href="#x">B</a><button id="after">After</button>');await control.locator('#a').focus();await control.keyboard.press('Tab');result.linkTabControl={expected:'b',actual:await control.evaluate(()=>document.activeElement.id)};await control.close();
 await page.goto(origin+'/tools/prime-factorizer/',{waitUntil:'domcontentloaded',timeout:30000});await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')!==null);
 assert.doesNotMatch(await page.locator('meta[name=viewport]').getAttribute('content'),/user-scalable\s*=\s*(no|0)|maximum-scale/i);
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const close=()=>page.evaluate(()=>{const p=document.querySelector('#site-menu');if(p.matches(':popover-open'))p.hidePopover();document.querySelector('.mobile-menu-fallback').open=false;});
 const native=page.locator('.mobile-menu-toggle'),panel=page.locator('#site-menu'),fallback=page.locator('.mobile-menu-fallback'),summary=fallback.locator('summary');
 for(const width of [280,320,360,393,480,760,768,1180])for(const textZoom of [1,2]){
  const c={width,textZoom,passed:false};result.cases.push(c);
  try{await close();await page.setViewportSize({width,height:844});await page.evaluate(z=>{document.documentElement.style.fontSize=z*100+'%';scrollTo(0,0);},textZoom);await settle();
   c.closed=await page.evaluate(measure);assertBounds(c.closed);assert.ok(c.closed.brandFont>=1.1*16*textZoom-.1);
   for(const selector of ['.mobile-search','.mobile-menu-toggle']){const box=await page.locator(selector).boundingBox();assert.ok(box.width>=43.99&&box.height>=43.99,selector+' '+JSON.stringify(box));}
   await native.focus();await native.press('Enter');await page.waitForFunction(()=>document.querySelector('#site-menu').matches(':popover-open'));await settle();
   assert.equal(await native.getAttribute('aria-expanded'),'true');
   const links=panel.locator('a');await links.first().evaluate(a=>{a.textContent='長い日本語のナビゲーション説明'.repeat(5)+'9'.repeat(80);});
   await settle();c.open=await page.evaluate(measure);assertBounds(c.open);
   c.panel=await panel.evaluate(p=>{const r=p.getBoundingClientRect();return{top:r.top,bottom:r.bottom,client:p.clientWidth,scroll:p.scrollWidth,height:r.height,scrollHeight:p.scrollHeight,viewportHeight:innerHeight};});
   assert.ok(c.panel.top>=c.open.header.bottom-1,JSON.stringify(c.panel));assert.ok(c.panel.bottom<=844+1,JSON.stringify(c.panel));assert.ok(c.panel.scroll<=c.panel.client+1,JSON.stringify(c.panel));
   assert.equal(await panel.getByRole('link').count(),await links.count());
   await links.first().focus();for(let i=1;i<await links.count();i++){
    if(result.linkTabControl.actual==='b'){await page.keyboard.press('Tab');assert.equal(await links.nth(i).evaluate(n=>n===document.activeElement),true,'link Tab step '+i);}
    else{await links.nth(i).focus();await links.nth(i).evaluate(n=>n.scrollIntoView({block:'nearest'}));}
   }
   await settle();const last=await links.last().boundingBox();assert.ok(last.y>=c.panel.top-1&&last.y+last.height<=c.panel.bottom+1,JSON.stringify(last));c.linkTraversal=result.linkTabControl.actual==='b'?'Tab verified':'programmatic focus/bounds only; minimal engine control skips links on Tab';
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#site-menu').matches(':popover-open'));assert.equal(await native.evaluate(n=>n===document.activeElement),true);
   await native.evaluate(n=>n.style.display='none');await fallback.evaluate(n=>n.style.display='block');await summary.focus();await summary.press('Enter');await page.waitForFunction(()=>document.querySelector('.mobile-menu-fallback').open);await settle();
   const nav=fallback.locator('nav');await nav.locator('a').first().evaluate(a=>{a.textContent='長い日本語のナビゲーション説明'.repeat(5)+'9'.repeat(80);});await settle();c.fallback=await page.evaluate(measure);assertBounds(c.fallback);assert.ok(await nav.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   const fallbackBox=await nav.boundingBox();assert.ok(fallbackBox.y>=c.fallback.header.bottom-1&&fallbackBox.y+fallbackBox.height<=845,JSON.stringify(fallbackBox));
   await page.keyboard.press('Escape');assert.equal(await summary.evaluate(n=>n===document.activeElement),true);assert.equal(await fallback.evaluate(n=>n.open),false);
   await native.evaluate(n=>n.style.removeProperty('display'));await fallback.evaluate(n=>n.style.removeProperty('display'));c.passed=true;
  }catch(e){c.error=String(e);process.exitCode=1;await close();await native.evaluate(n=>n.style.removeProperty('display'));await fallback.evaluate(n=>n.style.removeProperty('display'));}
 }
 await close();await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{document.documentElement.style.fontSize='100%';scrollTo(0,0);});await settle();await native.focus();
 for(const expected of [true,false]){await native.press('Space');await page.waitForFunction(open=>document.querySelector('#site-menu').matches(':popover-open')===open,expected);}
 await native.evaluate(b=>{for(let i=0;i<11;i++)b.click();});await page.waitForFunction(()=>document.querySelector('#site-menu').matches(':popover-open')&&document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='true');await page.mouse.click(4,4);await page.waitForFunction(()=>!document.querySelector('#site-menu').matches(':popover-open'));
 await native.focus();await native.press('Enter');await page.waitForFunction(()=>document.querySelector('#site-menu').matches(':popover-open'));
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await settle();const resized=await page.evaluate(measure);assertBounds(resized);assert.ok(await panel.evaluate(p=>p.getBoundingClientRect().top>=document.querySelector('.header-band').getBoundingClientRect().bottom-.5));
 await page.setViewportSize({width:360,height:844});await settle();assert.ok(await panel.evaluate(p=>p.getBoundingClientRect().top>=document.querySelector('.header-band').getBoundingClientRect().bottom-.5));
 await page.setViewportSize({width:360,height:480});await settle();assert.ok(await panel.evaluate(p=>p.getBoundingClientRect().bottom<=innerHeight+1));
 await page.setViewportSize({width:1181,height:844});await page.waitForFunction(()=>!document.querySelector('#site-menu').matches(':popover-open'));await page.setViewportSize({width:320,height:844});await settle();assert.equal(await panel.evaluate(p=>p.matches(':popover-open')),false);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await native.locator('.menu-icon > span').first().evaluate(n=>getComputedStyle(n).transitionDuration),'0s');result.transitions={spaceToggle:true,rapidToggleAndOutsideClose:true,resizeWhileOpen:true,shortViewport480:true,desktopCloses:true,reducedMotion:true};
 await page.evaluate(()=>scrollTo(0,0));await settle();await page.screenshot({path:resolve(out)+'.'+name+'.png',fullPage:true});await page.locator('.header-band').screenshot({path:resolve(out)+'.'+name+'.header.png'});
 assert.deepEqual(result.errors,[]);
 }catch(e){result.fatal=String(e);process.exitCode=1;}finally{await browser.close();}
 console.log(JSON.stringify({name,cases:result.cases.length,passed:result.cases.filter(c=>c.passed).length,failed:result.cases.filter(c=>!c.passed).map(c=>({width:c.width,textZoom:c.textZoom,error:c.error})),fatal:result.fatal}));
}}finally{await new Promise(r=>server.close(r));await writeFile(resolve(out),JSON.stringify(report,null,2)+'\n');}
