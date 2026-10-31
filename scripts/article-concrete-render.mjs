// Private fixture rendering only; no content import, storage upload or credentials.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {browserSession,loaded} from './article-concrete-browser.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function renderConcreteVisuals(){
 const out=join(repo,'.local/article-concrete'),raw=await readFile(join(out,'render-input.json'));
 if(raw.length>2*1024*1024)throw Error('RENDER_INPUT_TOO_LARGE');
 const input=JSON.parse(raw.toString('utf8'));
 if(input.protocol!=='xpotato-private-concrete-render-v2'||typeof input.fonts!=='string'||'logos' in input)throw Error('RENDER_INPUT_INVALID');
 const ids=['walls-a','walls-b','walls-c','orientation-a','orientation-b','roof-a','roof-b','roof-c'];
 const page=(body,w=320)=>'<html lang="ja"><meta charset="utf-8"><style>'+input.fonts+'html,body{margin:0;padding:0;width:'+w+'px;background:#faf9f7;font-synthesis:none;font-family:"Zen Kaku Gothic New",sans-serif;}svg{display:block}img{display:block}</style>'+body+'</html>';
 const virtual={},sources=[],images=[];
 for(const id of ids){const svg=await readFile(join(repo,'tests/fixtures/article-concrete',id+'.svg'),'utf8');if(hash(svg)!==input.diagrams?.[id])throw Error('RENDER_DIAGRAM_CHANGED');virtual['/diagram-'+id]=page(svg);}
 const browser=await browserSession(join(repo,'apps/site/public'),'/diagram-walls-a',virtual);
 try{for(const id of ids){
  const path='/diagram-'+id;
  await browser.send('Emulation.setDeviceMetricsOverride',{width:320,height:1200,deviceScaleFactor:2,mobile:false});
  await browser.send('Page.navigate',{url:browser.origin+path});
  for(let n=0;n<120&&await browser.js('location.pathname')!==path;n++)await new Promise(r=>setTimeout(r,100));
  await loaded(browser,'svg text');
  const doc=await browser.send('DOM.getDocument'),node=await browser.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'svg text'});
  const fonts=(await browser.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId})).fonts;
  if(!fonts.some(f=>/Zen.*Kaku/i.test(f.familyName)&&f.isCustomFont))throw Error('RENDER_DIAGRAM_FONT_MISSING');
  const clip=await browser.js('(()=>{const r=document.querySelector('+JSON.stringify('svg')+').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const shot=await browser.send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true}),bytes=Buffer.from(shot.data,'base64');
  await writeFile(join(out,id+'.png'),bytes);images.push({assetId:id,file:id+'.png',sha256:hash(bytes),sizeBytes:bytes.length});
  sources.push({asset:id,kind:'original-labelled-svg',sourceSha256:input.diagrams[id],font:fonts.map(f=>f.familyName)});
 }}finally{await browser.close();}
 const result={protocol:'xpotato-private-concrete-render-v2',renderInputSha256:hash(raw),productionEligible:false,sources,images};
 await writeFile(join(out,'rendered-visuals.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await renderConcreteVisuals();
