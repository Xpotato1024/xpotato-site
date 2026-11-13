// Run after build: node tools/qa/content-title-layout.mjs [absolute dist path].
// CHROME_PATH optionally selects an installed Chromium; iOS device QA remains separate.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {prepareServer} from './home-design-webkit.mjs';
const {server,origin}=await prepareServer(resolve(process.argv[2]??'apps/site/dist'));
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
const routes=['/articles/09wsw5yvd59gqrjaz5ee25y3mw/','/articles/77arj41r5z8amrn46pdx71mknr/','/projects/pandocker-x/','/tools/prime-factorizer/','/about/'];
const cases=[];
try{
  const page=await browser.newPage({viewport:{width:393,height:800},isMobile:true,deviceScaleFactor:3});
  const snapshot=()=>page.locator('.content-heading h1').evaluate(e=>{
    const range=document.createRange(),text=e.firstChild,lines=new Map();
    for(let i=0;i<text.length;i++){
      range.setStart(text,i);range.setEnd(text,i+1);
      const r=range.getBoundingClientRect(),line=lines.get(r.y)??{text:'',left:r.left,right:r.right};
      line.text+=text.textContent[i];line.left=Math.min(line.left,r.left);line.right=Math.max(line.right,r.right);lines.set(r.y,line);
    }
    return {lines:[...lines.values()].map(l=>l.text),spare:e.clientWidth-Math.max(...[...lines.values()].map(l=>l.right-l.left)),font:getComputedStyle(e).fontSize,wrap:getComputedStyle(e).textWrap,overflow:e.scrollWidth>e.clientWidth+1||document.documentElement.scrollWidth>innerWidth};
  });
  for(const route of routes){
    await page.goto(origin+route);await page.evaluate(()=>document.fonts.ready);
    let stable;
    for(const width of [320,375,385,390,391,392,393,394,395,396,397,398,399,400,401,402,410,430,768,1440]){
      await page.setViewportSize({width,height:800});const state=await snapshot();assert.equal(state.overflow,false,route+' '+width);
      if(route===routes[0]&&width>=390&&width<=402){stable??=state.lines;assert.deepEqual(state.lines,stable);assert.ok(state.spare>=32,'At least one glyph of width margin');}
      for(const height of [650,800,700]){await page.setViewportSize({width,height});for(const y of [0,150,300,0]){await page.evaluate(y=>scrollTo(0,y),y);assert.deepEqual((await snapshot()).lines,state.lines,'Height/scroll must not change wrapping');}}
      cases.push({route,width,...state});
    }
  }
  console.log(JSON.stringify({status:'PASS',scope:'Desktop Chromium, not iOS device verification',cases},null,2));
}finally{await browser.close();server.close();}
