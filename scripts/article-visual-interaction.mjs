import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,isAbsolute} from "node:path";
import {connect} from "node:net";
export async function verifyArticleVisualInteraction({root,send,evaluate,until,requests}){
 const receipt=JSON.parse(await readFile(join(root,".local/article-visual-isolation/receipt.json"),"utf8"));
 const child=spawn(process.execPath,["--import","tsx",join(root,"scripts/site.ts"),"article","candidate","preview","--job",receipt.jobId,"--candidate",receipt.targetSha256,"--json"],{
  cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"],env:process.env});
 let url,articleUrl,failure=false,text="";
 child.on("error",()=>{failure=true;});child.stdout.on("data",bytes=>{
  text+=bytes.toString("utf8");for(const line of text.split("\n"))try{const value=JSON.parse(line);if(value.url){url=value.url;articleUrl=value.articleUrl;}if(value.error)failure=true;}catch{}
 });child.stderr.resume();
 const screenshots=process.env.XPOTATO_ARTICLE_VISUAL_SCREENSHOTS;
 if(screenshots&&!isAbsolute(screenshots))throw Error("Absolute local screenshot directory required");
 const report={scope:"synthetic_fixture",realHumanAudit:false,approvalEligible:false,viewports:[],loopbackOnly:true};
 const capture=async name=>{
  if(!screenshots)return;await mkdir(screenshots,{recursive:true});
  const metrics=await send("Page.getLayoutMetrics"),width=metrics.cssContentSize.width,height=Math.min(metrics.cssContentSize.height,20000);
  const image=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});
  await writeFile(join(screenshots,name),Buffer.from(image.data,"base64"));
 };
 let idle;
 try{
  await until(()=>{if(failure||child.exitCode!==null)throw Error("A4 candidate preview startup failed");return url;},"A4 private localhost");
  const start=requests.length,origin=new URL(url).origin;
  for(const viewport of [{name:"desktop",width:1487,height:1058,mobile:false},{name:"mobile",width:390,height:844,mobile:true},{name:"narrow",width:320,height:740,mobile:true}]){
   await send("Emulation.setDeviceMetricsOverride",{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.mobile});
   await send("Page.navigate",{url:articleUrl});
   await until(()=>evaluate('document.readyState==="complete"&&document.querySelector(".prose")?.textContent.includes('+JSON.stringify(receipt.marker)+')'),"A4 article body");
   await evaluate("document.fonts.ready");
   await evaluate('Promise.all([...document.querySelectorAll("picture img")].map(async image=>{image.loading="eager";if(!image.complete)await new Promise((resolve,reject)=>{image.addEventListener("load",resolve,{once:true});image.addEventListener("error",reject,{once:true});});return image.decode();}))');
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"A4 viewport overflow");
   assert.equal(await evaluate('document.querySelectorAll("h1").length'),1);
   assert.equal(await evaluate('document.querySelectorAll("iframe,astro-island").length'),0);
   assert.ok(await evaluate('document.querySelectorAll("a[data-footnote-ref]").length===1'));
   const images=await evaluate('[...document.querySelectorAll("picture img")].map(image=>({width:image.width,height:image.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,src:new URL(image.currentSrc).pathname,alt:image.alt}))');
   assert.equal(images.length,3);assert.ok(images.every(image=>image.naturalWidth>0&&image.alt===""));
   assert.ok(images.every(image=>/^\/__candidate_media\/[a-f0-9]{64}\.(?:jpg|png|webp|avif)$/u.test(image.src)));
   assert.equal(await evaluate('document.querySelector("pre code").textContent.includes("<div class=")'),true,"Code remains literal");
   await evaluate('document.querySelector("a[data-footnote-ref]").click()');
   assert.ok(await evaluate('location.hash.includes("fn-")'));
   await evaluate("scrollTo(0,0)");await capture("article-candidate-"+viewport.name+".png");
   report.viewports.push({width:viewport.width,height:viewport.height,images:images.map(({width,height,naturalWidth,naturalHeight})=>({width,height,naturalWidth,naturalHeight})),overflow:false,footnotes:true});
  }
  await send("Page.navigate",{url});await until(()=>evaluate('document.readyState==="complete"&&document.querySelector("h1")?.textContent.includes("手書き")'),"A4 review bundle");
  await evaluate('Promise.all([...document.querySelectorAll("picture img")].map(async image=>{image.loading="eager";return image.decode();}))');
  assert.ok(await evaluate('document.body.textContent.includes("参考preview（承認不可）")&&document.body.textContent.includes("権利と保存計画")'));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,"A4 review mobile overflow");
  await capture("article-review-mobile.png");
  const fetched=requests.slice(start).filter(request=>/^https?:/u.test(request.url));
  assert.ok(fetched.length>5);assert.ok(fetched.every(request=>new URL(request.url).origin===origin),"No provider/source/external assets");
  assert.equal(await evaluate('fetch("/artifact.json").then(()=>false,()=>true)'),true,"CSP denies runtime fetch");
  assert.equal((await fetch(url+"artifact.json")).status,404);
  idle=connect({host:"127.0.0.1",port:new URL(url).port});await new Promise((resolve,reject)=>{idle.once("connect",resolve);idle.once("error",reject);});
  console.log("Private A4 browser PASS: actual hero/inline/srcset/font/layout at desktop/390/320; footnotes and literal code; review/gallery/rights/storage plan; loopback assets only, no fetch/provider/publication.");
  if(screenshots)await writeFile(join(screenshots,"article-visual-browser.json"),JSON.stringify(report,null,2)+"\n");
 }finally{
  if(child.exitCode===null){
   const stopped=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill("SIGKILL");reject(Error("A4 preview shutdown timeout"));},8000);child.once("exit",()=>{clearTimeout(timer);resolve();});});
   child.kill("SIGTERM");await stopped;
  }
  idle?.destroy();
  await send("Emulation.setDeviceMetricsOverride",{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
 }
 return report;
}
