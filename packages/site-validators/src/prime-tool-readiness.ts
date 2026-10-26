import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {browserToolReleases} from "../../../apps/site/src/content-registry/interactive/releases.js";
import {interactiveModuleRegistry} from "../../../apps/site/src/content-registry/interactive/index.js";
import {readRegisteredToolRoutes,validateRegisteredToolHtml} from "./tool-runtime-policy.js";
import {verifyToolPin} from "./browser-tool-adoption.js";
import {headersForPath,parseStaticHeaderRules} from "../../../scripts/static-headers.mjs";
export async function checkPinnedPrimeReadiness(root:string){
 const tools=await readRegisteredToolRoutes(),prime=tools.find(t=>t.asyncCompute);
 assert.ok(prime);assert.equal(prime.route,"/tools/prime-factorizer/");
 const module=interactiveModuleRegistry["prime-factorizer"];
 assert.ok(module,"Pinned Prime module must be registered");
 const pin=browserToolReleases.find(p=>p.toolId==="prime-factorizer"&&p.releaseId===module.releaseId);assert.ok(pin);
 const manifest=await verifyToolPin(join(root,"vendor/browser-tools"),pin);
 if(manifest.license.additional?.includes("vendor/emscripten/MUSL-COPYRIGHT.txt")){
  const notice=await readFile(join(root,"vendor/browser-tools",pin.toolId,pin.releaseId,"vendor/emscripten/MUSL-COPYRIGHT.txt"));
  const publicNotice="tool-licenses/prime-factorizer-v"+manifest.version+"/MUSL-COPYRIGHT.txt";
  assert.deepEqual(await readFile(join(root,"apps/site/public",publicNotice)),notice);
  assert.deepEqual(await readFile(join(root,"apps/site/dist",publicNotice)),notice);
 }
 const html=await readFile(join(root,"apps/site/dist/tools/prime-factorizer/index.html"),"utf8");
 assert.deepEqual(validateRegisteredToolHtml("tools/prime-factorizer/index.html",html,tools),[]);
 assert.ok(html.includes("data-tool-release="+JSON.stringify(pin.releaseId)));
 assert.ok(html.includes(pin.sourceCommit));
 const siteCommit=execFileSync("git",["-c","core.fsmonitor=false","-C",root,"rev-parse","HEAD"],{encoding:"utf8",env:{...process.env,GIT_NO_REPLACE_OBJECTS:"1",GIT_OPTIONAL_LOCKS:"0"}}).trim();
 assert.match(siteCommit,/^[a-f0-9]{40}$/u);
 assert.ok(html.includes('data-site-source-commit="'+siteCommit+'"'),"Site source offer must match the actual build checkout");
 assert.ok(html.includes("https://github.com/Xpotato1024/xpotato-site/blob/"+siteCommit+"/SITE_SOURCE_OFFER.md"));
 const component=await readFile(join(root,"apps/site/src/components/islands/PrimeFactorizer.tsx"),"utf8");
 assert.match(component,/export \{default\} from ["']@xpotato-tool\/prime-factorizer["']/u);
 assert.ok(!/\bfactorize\s*\(/u.test(component)&&!component.includes("Number("));
 const headers=parseStaticHeaderRules(await readFile(join(root,"apps/site/dist/_headers"),"utf8"));
 const csp=headersForPath(prime.route,headers)["content-security-policy"]!;
 assert.ok(csp.includes("worker-src blob:")&&csp.includes("'wasm-unsafe-eval'")&&csp.includes("connect-src 'none'"));
 assert.ok(!csp.includes("'unsafe-eval'")&&!csp.includes("'unsafe-inline'"));
 for(const path of ["/","/search/","/blog/unpublished/","/unknown/"])assert.ok(!headersForPath(path,headers)["content-security-policy"]?.includes("'wasm-unsafe-eval'"));
 return {toolId:manifest.toolId,releaseId:pin.releaseId,sourceCommit:pin.sourceCommit,artifactSha256:pin.artifactSha256,
 legacyParity:"NOT_APPLICABLE: explicitly superseded by reviewed exact-integer async release; frozen records retained"};
}
