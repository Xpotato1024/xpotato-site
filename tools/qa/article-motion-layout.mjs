// Real browser acceptance for shared article motion geometry. Synthetic pixels only.
import assert from "node:assert/strict";
import {readFile,writeFile,mkdtemp,mkdir,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {renderRegistryPicture} from "../../packages/portable-content/src/media-picture.ts";
import {contentMediaRegistrySchema} from "../../packages/content-contracts/src/media.ts";
import {browserSession,loaded} from "../review/articles/article-concrete-browser.mjs";

const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const root=await mkdtemp(join(tmpdir(),"xpotato-motion-layout-")),outputArg=process.argv.find(x=>x.startsWith("--output="));
const output=outputArg?resolve(outputArg.slice("--output=".length)):undefined;
if(output)await mkdir(output,{recursive:true});
let session;
try{
 const moving=await sharp(Buffer.concat(["8c6ba6","c9b5d4"].map(c=>Buffer.from(c.repeat(800*300),"hex"))),
  {raw:{width:800,height:600,channels:3,pageHeight:300}}).webp({lossless:true,loop:0,delay:[500,500]}).toBuffer();
 const poster=await sharp({create:{width:800,height:300,channels:3,background:"#d4cbdc"}}).webp({lossless:true}).toBuffer();
 const object=bytes=>({sha256:hash(bytes),objectKey:"media/v1/objects/sha256/"+hash(bytes).slice(0,2)+"/"+hash(bytes)+".webp",format:"webp",width:800,height:300,sizeBytes:bytes.length});
 const still=object(poster),motion={...object(moving),animation:{frameCount:2,delaysMs:[500,500],loop:0}};
 const canonical=object=>({storageClass:"private_canonical_media_v1",sha256:object.sha256,format:object.format,width:object.width,height:object.height,sizeBytes:object.sizeBytes,ingestProfileId:"synthetic-layout-fixture",ingestProfileSha256:hash("fixture"),...(object.animation?{animation:object.animation}:{})});
 const base={role:"inline",origin:"diagram",status:"active",defaultAlt:"Synthetic motion layout fixture",rightsRef:"synthetic-fixture",provenanceRef:"synthetic-fixture"};
 const ids=["motion-a","motion-b","motion-c","motion-standalone"],registry=contentMediaRegistrySchema.parse({schemaVersion:1,contentId:"f8a847d4-8f5d-4bb0-a387-750f096479f2",assets:[
  {...base,assetId:"poster",canonicalSource:canonical(still),delivery:{mode:"fixed",master:still,variants:[]}},
  ...ids.map(assetId=>({...base,assetId,canonicalSource:canonical(motion),delivery:{mode:"animated",posterAssetId:"poster",profileId:"animation-inline-v1",profileSha256:hash("fixture"),master:motion,variants:[motion]}}))
 ]});
 const picture=assetId=>renderRegistryPicture({registry,assetId,urlFor:o=>"/__candidate_media/"+o.sha256+".webp"});
 const markup=[
  '<figure class="article-figure">'+picture(ids[0])+'<figcaption><strong class="article-figure__title">Long caption wraps beside the control without covering the image or creating a separate control row.</strong></figcaption></figure>',
  '<figure class="article-figure">'+picture(ids[1])+'</figure>',
  '<figure class="article-figure">'+picture(ids[2])+'<figcaption><strong class="article-figure__title">Short caption</strong></figcaption></figure>',
  picture(ids[3])
 ].join("\n");
 const css=(await Promise.all(["content.css","article-structure.css","article-modules.css"].map(f=>readFile("apps/site/src/styles/"+f,"utf8")))).join("\n");
 await mkdir(join(root,"__candidate_media"));await writeFile(join(root,"__candidate_media",still.sha256+".webp"),poster);await writeFile(join(root,"__candidate_media",motion.sha256+".webp"),moving);
 await writeFile(join(root,"motion.js"),await readFile("apps/site/public/scripts/article-motion.js"));
 await writeFile(join(root,"index.html"),'<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{font-size:16px;--surface:white;--text-primary:#28222e;--text-muted:#5d5663;--border-divider:#cbc4d0;--accent:#76538e}*{box-sizing:border-box}body{margin:16px}.prose{max-width:832px;margin-inline:auto}figure{margin-inline:0}'+css+'</style><article class="prose">'+markup+'</article><script src="/motion.js" defer></script></html>');
 session=await browserSession(root,"/index.html");await session.send("Page.bringToFront");
 const inspect=()=>session.js('(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}},images=[...document.images].map(rect);return {overflow:document.documentElement.scrollWidth>innerWidth,images,hosts:[...document.querySelectorAll("[data-article-motion]")].map(h=>{const b=h.querySelector("[data-motion-toggle]"),c=h.closest("figure")?.querySelector("figcaption"),v=h.querySelector("[data-motion-view]"),i=v.querySelector("img");return {playing:h.dataset.playing,visible:!!b.getClientRects().length,button:rect(b),caption:c?rect(c):null,view:rect(v),image:rect(i),asset:i.dataset.mediaAsset,pressed:b.getAttribute("aria-pressed"),label:b.getAttribute("aria-label")}})}})()');
 const intersects=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
 const assertGeometry=state=>{
  assert.equal(state.overflow,false);assert.equal(state.hosts.length,4);
  for(const host of state.hosts){
   if(!host.visible)continue;
   assert(host.button.width>=44&&host.button.height>=44,"44px control target required");
   for(const image of state.images)assert(!intersects(host.button,image),"Motion control intersects image pixels");
   assert(host.button.top>=host.image.bottom,"Control must be below image");
   if(host.caption){
    assert(host.caption.right<=host.button.left,"Caption must not run behind the control");
    assert(host.caption.top<host.button.bottom&&host.button.top<host.caption.bottom,"Caption and control must share a row");
   }
  }
 };
 const cases=[];
 for(const width of [320,390,1440])for(const mode of ["normal","reduced","no-js"]){
  await session.send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
  await session.send("Emulation.setScriptExecutionDisabled",{value:mode==="no-js"});
  await session.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:mode==="reduced"?"reduce":"no-preference"}]});
  await session.send("Page.navigate",{url:session.origin+"/index.html?case="+width+"-"+mode});await loaded(session,"article");
  let state=await inspect();assertGeometry(state);
  assert(state.hosts.every(h=>h.playing===(mode==="normal"?"true":"false")));
  if(mode==="no-js"){
   assert(state.hosts.every(h=>!h.visible&&h.asset==="poster"));
   for(const host of state.hosts.filter(h=>h.caption))assert(Math.abs(host.caption.width-host.view.width)<1,"No-JS caption should retain full width");
  }else{
   assert(state.hosts.every(h=>h.visible));
   // Native Enter dispatch changes one control while the other figures keep their state.
   const before=state.hosts.map(h=>h.playing);
   assert(await session.js('(()=>{const b=document.querySelector("[data-motion-toggle]");b.focus();return document.activeElement===b})()'),"Native button focus required");
   await session.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:"\r",unmodifiedText:"\r"});
   await session.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
   await session.js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   await loaded(session,"article");state=await inspect();assertGeometry(state);
   assert.equal(state.hosts[0].playing,before[0]==="true"?"false":"true");assert.deepEqual(state.hosts.slice(1).map(h=>h.playing),before.slice(1));
   assert.equal(state.hosts[0].pressed,state.hosts[0].playing);
   // Real pointer activation resumes/pauses without moving the control over pixels.
   const b=state.hosts[0].button,x=(b.left+b.right)/2,y=(b.top+b.bottom)/2;
   await session.send("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",clickCount:1,x,y});
   await session.send("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",clickCount:1,x,y});
   await loaded(session,"article");state=await inspect();assertGeometry(state);assert.equal(state.hosts[0].playing,before[0]);
   await session.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
   await session.js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   assert((await inspect()).hosts.every(h=>h.playing==="false"));
  }
  await session.js('scrollTo({top:0,behavior:"instant"})');
  if(output){const shot=await session.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});await writeFile(join(output,width+"-"+mode+".png"),Buffer.from(shot.data,"base64"));}
  cases.push({width,mode,controls:4,allImagesUnobscured:true,captionRow:true,keyboardAndPointer:mode==="no-js"?"not_applicable":"pass"});
 }
 const report={scope:"synthetic shared-renderer browser regression",browser:"Chromium via native CDP",cases};
 if(output)await writeFile(join(output,"report.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify(report));
}finally{
 await session?.close();await rm(root,{recursive:true,force:true});
}
