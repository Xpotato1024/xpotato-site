import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
export async function verifyContentReviewInteraction({root,send,evaluate,until,requests}){
 const receipt=JSON.parse(await readFile(join(root,".local/article-review-isolation/receipt.json"),"utf8"));
 const child=spawn(process.execPath,["--import","tsx",join(root,"scripts/site.ts"),"article","review","preview","--job",receipt.jobId,"--json"],{
  cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"],env:process.env});
 let url,failure=false,text="";
 child.on("error",()=>{failure=true;});child.stdout.on("data",bytes=>{
  text+=bytes.toString("utf8");for(const line of text.split("\n"))try{const item=JSON.parse(line);if(item.url)url=item.url;if(item.error)failure=true;}catch{}
 });child.stderr.resume();
 try{
  await until(()=>{if(failure||child.exitCode!==null)throw Error("Content review startup failed");return url;},"content review localhost");
  const start=requests.length;await send("Page.navigate",{url});
  await until(()=>evaluate('document.readyState==="complete"&&document.querySelector("main")?.textContent.includes('+JSON.stringify(receipt.marker)+')'),"content review body");
  assert.equal(await evaluate('document.querySelectorAll("script,img,iframe,astro-island").length'),0);
  assert.ok(await evaluate('document.body.textContent.includes("CONTENT_READY")&&document.body.textContent.includes("HUMAN_REVIEW_READY未成立")'));
  assert.ok(await evaluate('document.body.textContent.includes("public-origin-unconfirmed")&&document.body.textContent.includes("storage-plan-unconfirmed")'));
  assert.ok(await evaluate('document.querySelectorAll("a[data-footnote-ref]").length===1'));
  assert.ok(await evaluate('document.body.textContent.includes("未実行")'));
  assert.ok(await evaluate('document.body.textContent.includes("合成fixture: 構文・型検査済み（動作は未検証）")'));
  assert.ok(!(await evaluate('document.body.textContent')).includes(receipt.privateSourceMarker),"private source snapshot never served");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),"review mobile overflow");
  await evaluate('document.querySelector("a[data-footnote-ref]").click()');
  assert.deepEqual(requests.slice(start).filter(request=>/^https?:/u.test(request.url)).map(request=>request.url),[url],"one loopback document only, no assets/provider/source fetch");
  assert.equal(await evaluate('fetch("/working-sources.json").then(()=>false,()=>true)'),true,"review CSP blocks runtime fetch");
  assert.equal((await fetch(url+"review.json")).status,404,"job JSON is not served");
  await send("Emulation.setDeviceMetricsOverride",{width:1487,height:1058,deviceScaleFactor:1,mobile:false});
  console.log("Private content review browser PASS: compiled footnotes, claims and unexecuted examples, CONTENT_READY distinct from review-ready, mobile, one loopback document/no assets/provider/private source");
 }finally{
  if(child.exitCode===null){child.kill("SIGTERM");await new Promise(resolve=>child.once("exit",resolve));}
 }
}
