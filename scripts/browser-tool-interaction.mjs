import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {readFile,stat,writeFile} from "node:fs/promises";
import {join,resolve,sep,extname} from "node:path";
import {headersForPath,parseStaticHeaderRules} from "./static-headers.mjs";

export function assertToolQuiet(events,serverRequests,canary) {
  assert.equal(events.length,0,"ready-after operations must generate zero network/socket/navigation/popup/error events");
  assert.equal(serverRequests.length,0,"test HTTP server observed a ready-after request");
  assert.ok(!JSON.stringify(events).includes(canary),"canary escaped into transport");
}
export async function verifyBrowserToolInteraction({root,temp,send,evaluate,until,socket,generated=false}) {
  await new Promise((resolveChild,reject)=>{
    const child=spawn(process.execPath,["--import","tsx",join(root,"scripts/browser-tool-fixture.ts"),...(generated?["--generated"]:[])],{
      cwd:root,windowsHide:true,env:process.env,stdio:["ignore","pipe","pipe"]});
    let output="";for(const stream of [child.stdout,child.stderr])stream.on("data",chunk=>{output+=chunk.toString();});
    child.on("error",reject);child.on("exit",code=>code===0?resolveChild():reject(Error("Tool fixture failed: "+output)));
  });
  const fixtureFolder=generated?"browser-tool-authoring-acceptance":"browser-tool-acceptance";
  const receipt=JSON.parse(await readFile(join(root,".local",fixtureFolder,"receipt.json"),"utf8"));
  const dist=resolve(root,receipt.dist),rules=parseStaticHeaderRules(await readFile(join(dist,"_headers"),"utf8"));
  const http=[],events=[];
  const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".css":"text/css"};
  const server=createServer(async(req,res)=>{
    const record={url:req.url,headers:req.headers,body:""};http.push(record);
    req.on("data",chunk=>{record.body+=chunk.toString();});
    try{
      const url=new URL(req.url,"http://localhost"),path=resolve(dist,"."+decodeURIComponent(url.pathname));
      if(path!==dist&&!path.startsWith(dist+sep))throw Error("Path escape");
      const file=(await stat(path)).isDirectory()?join(path,"index.html"):path;
      const headers=headersForPath(url.pathname,rules);
      res.writeHead(200,{...headers,"Content-Type":mime[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});
      res.end(await readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolveServer=>server.listen(0,"127.0.0.1",resolveServer));
  const origin="http://127.0.0.1:"+server.address().port;
  const fixtureUrl=origin+"/tools/synthetic-counter/";
  const canary="入力canary-漢字-<img src=x onerror=alert(1)>-&-27ac0";
  const listener=event=>{
    const m=JSON.parse(String(event.data));
    if(m.method==="Network.requestWillBeSent")events.push({kind:"request",...m.params.request,redirect:m.params.redirectResponse??null});
    if(["Network.webSocketCreated","Network.webTransportCreated","Page.windowOpen","Page.frameRequestedNavigation","Page.frameStartedNavigating","Page.navigatedWithinDocument","Runtime.exceptionThrown"].includes(m.method))
      events.push({kind:m.method,details:m.params});
  };
  socket.addEventListener("message",listener);
  let preload;
  try{
    await send("Network.setCacheDisabled",{cacheDisabled:true});
    await send("Network.setBypassServiceWorker",{bypass:true});
    await send("Storage.clearDataForOrigin",{origin,storageTypes:"all"});
    preload=await send("Page.addScriptToEvaluateOnNewDocument",{source:'window.__toolViolations=[];window.__toolRejections=[];addEventListener("securitypolicyviolation",e=>__toolViolations.push({directive:e.violatedDirective,blocked:e.blockedURI}));addEventListener("unhandledrejection",e=>__toolRejections.push(String(e.reason)));'});
    await send("Page.navigate",{url:fixtureUrl});
    await until(()=>evaluate('document.readyState==="complete" && document.querySelectorAll("[data-tool-state=ready]").length===2'),'two fixture islands ready');
    await evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
    await new Promise(resolveDelay=>setTimeout(resolveDelay,300));
    const initial=events.filter(event=>event.kind==="request");
    assert.ok(initial.length>2,"Fixture loads actual island assets");
    for(const event of initial){
      const url=new URL(event.url);
      assert.equal(url.origin,origin,"Initial assets must stay same origin");
      assert.equal(url.search,"");assert.equal(event.redirect,null,"Initial redirect forbidden");
      assert.ok(url.pathname==="/tools/synthetic-counter/"||receipt.files.includes(url.pathname.slice(1)),"Only fixed fixture build assets: "+event.url);
    }
    assert.equal(events.filter(event=>event.kind==="Runtime.exceptionThrown").length,0);
    assert.deepEqual(await evaluate('__toolViolations'),[]);assert.deepEqual(await evaluate('__toolRejections'),[]);
    assert.equal(await evaluate('new Set(Array.from(document.querySelectorAll("[id]"),n=>n.id)).size===document.querySelectorAll("[id]").length'),true,"instance IDs unique");
    const operations=async()=>{
      const results=[];
      for(const value of ["日本語🙂",canary,"x".repeat(4096),"x".repeat(4097)]){
        await evaluate('(()=>{const n=document.querySelector("#fixture-a-input");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(n,'+JSON.stringify(value)+');n.dispatchEvent(new Event("input",{bubbles:true}));})()');
        await evaluate('document.querySelector("#fixture-a-input").form.requestSubmit()');
        const over=new TextEncoder().encode(value).length>4096;
        const expected=over?"入力は4096 bytes以内にしてください":"文字数: "+Array.from(value).length+(generated?"":" / "+value);
        const resultNode=generated&&over?'document.querySelector("#fixture-a-input-error")':'document.querySelectorAll("output")[0]';
        await until(()=>evaluate(resultNode+'.textContent==='+JSON.stringify(expected)),"deterministic Tool conversion");
        results.push(await evaluate(resultNode+'.textContent'));
        assert.equal(await evaluate('document.querySelectorAll("output")[1].textContent'),"","second instance state independent");
      }
      assert.equal(await evaluate('document.querySelectorAll("[data-browser-tool] img,[data-browser-tool] script").length'),0,"Malicious input rendered as text");
      await evaluate('document.querySelector("#fixture-a-input").form.querySelector("button[type=button]").click()');
      await until(()=>evaluate('document.querySelector("#fixture-a-input").value==="" && document.querySelectorAll("output")[0].textContent===""'),"reset");
      return results;
    };
    events.length=0;http.length=0;
    const started=performance.now(),online=await operations(),elapsed=performance.now()-started;
    await new Promise(resolveDelay=>setTimeout(resolveDelay,200));
    assertToolQuiet(events,http,canary);
    await send("Network.emulateNetworkConditions",{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    const offline=await operations();assert.deepEqual(offline,online,"Offline computation results equal ready-after online results");
    await new Promise(resolveDelay=>setTimeout(resolveDelay,200));
    assertToolQuiet(events,http,canary);
    assert.equal(await evaluate('location.href'),fixtureUrl,"Input never enters page URL");
    assert.deepEqual(await evaluate('({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie})'),{local:0,session:0,cookies:""});
    assert.deepEqual(await evaluate('indexedDB.databases().then(a=>a.map(x=>x.name))'),[]);
    assert.deepEqual(await evaluate('caches.keys()'),[]);
    assert.deepEqual(await evaluate('__toolViolations'),[]);assert.deepEqual(await evaluate('__toolRejections'),[]);
    // Measure the pure core separately from CDP/React round trips; this is a bounded fixture, not a giant PrimeFactorizer performance claim.
    const coreBytes=await readFile(join(root,".local",fixtureFolder,"vendor/synthetic-counter/fixture-v1/core.mjs"),"utf8");
    const timing=await evaluate('(()=>{'+coreBytes.replace("export function","function")+';const value="x".repeat(4096);let max=0;for(let i=0;i<100;i++){const t=performance.now();convert(value);max=Math.max(max,performance.now()-t);}return max;})()');
    assert.ok(timing<=50,"Fixture maxComputeMs budget");
    // After the measured acceptance window, prove the real CDP + HTTP observers with a test-only image.
    await send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await evaluate('(()=>{const probe=new Image();probe.src="/tool-observer-probe";})()');
    await until(()=>events.some(event=>event.kind==="request" && event.url===origin+"/tool-observer-probe")
      && http.some(request=>request.url==="/tool-observer-probe"),"live CDP and HTTP detector self-check");
    assert.throws(()=>assertToolQuiet(events,[],canary));assert.throws(()=>assertToolQuiet([],http,canary));
    await evaluate('fetch("/tool-csp-observer-probe").catch(()=>null)');
    await until(()=>evaluate('__toolViolations.some(event=>event.directive==="connect-src")'),"live blocked-send CSP observation");
    const report={scope:receipt.scope,selected:receipt.selected,
      sourceCommits:receipt.pins.map(pin=>pin.sourceCommit),sourceBuildsPerVersion:2,initialRequests:initial.length,readyAfterRequests:0,
      websocketAndNavigation:0,offlineEqual:true,liveDetectorSelfCheck:true,blockedSendObserved:true,inputLimits:[4096,4097],instances:2,untrustedTextEscaped:true,
      maxObservedCoreMs:timing,declaredMaxComputeMs:50,operationWallMs:elapsed,
      browser:await send("Browser.getVersion"),unrun:["Firefox","WebKit","iOS real device"],productionBuildCount:0,fixtureHostBuildCount:1};
    await writeFile(join(temp,generated?"browser-tool-template-ready-offline.json":"browser-tool-ready-offline.json"),JSON.stringify(report,null,2)+"\n");
    console.log("Synthetic Tool browser PASS: fixed local vendor/file lock/explicit Astro React islands; ready-after and offline zero CDP+HTTP requests, two independent instances, input bounds, escaping, reset, storage and timing");
    return report;
  }finally{
    await send("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    if(preload)await send("Page.removeScriptToEvaluateOnNewDocument",{identifier:preload.identifier});
    socket.removeEventListener("message",listener);
    await new Promise(resolveClose=>server.close(resolveClose));
  }
}
