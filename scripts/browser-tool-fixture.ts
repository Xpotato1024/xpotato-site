import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdir,readFile,writeFile,readdir,rm} from "node:fs/promises";
import {dirname,join,resolve,relative} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {validateToolReleaseBindings} from "../packages/site-validators/src/browser-tool-bindings.js";
import {interactiveModuleRecordSchema} from "@xpotato/content-contracts";
import {createToolFixture,updateToolFixture} from "../packages/site-validators/src/browser-tool-fixture.js";
import {verifyToolPin,selectToolRelease,toolHash,noToolLinks} from "../packages/site-validators/src/browser-tool-adoption.js";
import {analyzeBuiltHtml,renderSecurityHeaderArtifact} from "../packages/site-validators/src/security-headers.js";

import {describeBrowserToolRelease} from "../packages/site-validators/src/browser-tool-display.js";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const generated=process.argv.includes("--generated");
const fixtureFolder=generated?"browser-tool-authoring-acceptance":"browser-tool-acceptance";
const temporary=join(root,".local",fixtureFolder);
await mkdir(join(root,".local"),{recursive:true});
await noToolLinks(join(root,".local"));
try{await noToolLinks(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
if(relative(root,temporary).split(/[\\\\/]/u).join("/")!==".local/"+fixtureFolder)throw Error("Fixture cleanup target escaped workspace");
await rm(temporary,{recursive:true,force:true});await mkdir(temporary);
const fixture=await createToolFixture(temporary,{generated}),second=await updateToolFixture(temporary,fixture);
const pins=[fixture.pin,second];
const chosen=await selectToolRelease(fixture.vendorRoot,pins,"synthetic-counter","fixture-v1",true);
await verifyToolPin(fixture.vendorRoot,chosen);
const moduleRecord=interactiveModuleRecordSchema.parse({id:"synthetic-counter",framework:"react",componentId:"synthetic-counter-react-v1",
 hydration:"load",allowedCollections:["tools"],role:"primary_tool",status:"active",apiVersion:1,budgetClass:"small",releaseId:chosen.releaseId});
validateToolReleaseBindings({"synthetic-counter":moduleRecord},pins,true);
const releaseInfo=describeBrowserToolRelease({module:moduleRecord,pins,fixtureOnly:true,manifestSources:{[chosen.toolId+":"+chosen.releaseId]:await readFile(join(fixture.vendorRoot,chosen.toolId,chosen.releaseId,"browser-tool.json"),"utf8")}});
assert.equal(releaseInfo?.scope,"synthetic-fixture");
const host=join(temporary,"host");await mkdir(join(host,"src/pages/tools"),{recursive:true});
await mkdir(join(host,"public"));
await writeFile(join(host,"public/favicon.svg"),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#555" d="M2 2h12v12H2z"/></svg>\n');
const siteRequire=createRequire(join(root,"apps/site/package.json"));
const installed:Record<string,string>={};
for(const name of ["astro","react","react-dom","@astrojs/react"]){
 let folder=dirname(siteRequire.resolve(name));
 while(true){
  try{if(JSON.parse(await readFile(join(folder,"package.json"),"utf8")).name===name)break;}catch{}
  const parent=dirname(folder);if(parent===folder)throw Error("Installed package root missing: "+name);folder=parent;
 }
 installed[name]=folder;
}
const astroRoot=installed.astro!;
await writeFile(join(host,"package.json"),JSON.stringify({name:"private-browser-tool-fixture",version:"0.0.0",private:true,type:"module",
  dependencies:{"@xpotato-tool/synthetic-counter":"file:../vendor/synthetic-counter/fixture-v1",
   ...Object.fromEntries(Object.entries(installed).map(([name,path])=>[name,"file:"+relative(host,path).replaceAll("\\","/")]))}},null,2)+"\n");
await writeFile(join(host,"astro.config.mjs"),'import {defineConfig} from '+JSON.stringify(pathToFileURL(siteRequire.resolve("astro/config")).href)+';\nimport react from '+JSON.stringify(pathToFileURL(siteRequire.resolve("@astrojs/react")).href)+';\nexport default defineConfig({integrations:[react()],vite:{ssr:{noExternal:["@astrojs/react"]},resolve:{alias:{react:'+JSON.stringify(dirname(siteRequire.resolve("react/package.json")))+',"react-dom":'+JSON.stringify(dirname(siteRequire.resolve("react-dom/package.json")))+'},dedupe:["react","react-dom"]}}});\n');
await writeFile(join(host,"src/FixturePair.mjs"),'import {createElement as h} from "react";\nimport Tool from "@xpotato-tool/synthetic-counter";\nexport default function Pair({instanceId,locale}){return h("div",null,h(Tool,{instanceId:instanceId+"-a",locale}),h(Tool,{instanceId:instanceId+"-b",locale}));}\n');
const notice=join(root,"apps/site/src/components/content/ToolReleaseNotice.astro");
const markup='---\nimport Pair from "../../FixturePair.mjs";\nimport "../../../../vendor/synthetic-counter/fixture-v1/tool.css";\n'
  +'import ToolReleaseNotice from '+JSON.stringify(notice)+';\nconst releaseInfo='+JSON.stringify(releaseInfo)+';\nconst record='+JSON.stringify(moduleRecord)+';\n'
  +'---\n<!doctype html><html lang="ja"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><link rel="icon" type="image/svg+xml" href="/favicon.svg"/><title>非公開fixture</title></head><body><main><h1>SYNTHETIC_BROWSER_TOOL_ONLY</h1><ToolReleaseNotice release={releaseInfo}/><section data-interactive-module={record.id}><Pair instanceId="fixture" locale="ja-JP" client:load /></section></main></body></html>\n';
await writeFile(join(host,"src/pages/tools/synthetic-counter.astro"),markup);
const npm=process.env.npm_execpath;if(!npm)throw Error("Run through npm run browser-tools:fixture");
const npmArgs=["--prefix",host,"--ignore-scripts","--offline","--omit=peer","--no-audit","--no-fund"];
execFileSync(process.execPath,[npm,"install","--package-lock-only",...npmArgs],{cwd:root,stdio:"pipe"});
execFileSync(process.execPath,[npm,"ci",...npmArgs],{cwd:root,stdio:"pipe"});
const hostLock=JSON.parse(await readFile(join(host,"package-lock.json"),"utf8"));
assert.equal(hostLock.packages[""].dependencies[chosen.packageName],"file:../vendor/synthetic-counter/fixture-v1");
assert.equal(hostLock.packages["node_modules/"+chosen.packageName].link,true);
const astro=JSON.parse(await readFile(join(astroRoot,"package.json"),"utf8"));
execFileSync(process.execPath,[join(astroRoot,astro.bin.astro),"build","--root",host],{cwd:root,stdio:"pipe",env:{...process.env,ASTRO_TELEMETRY_DISABLED:"1"}});
const dist=join(host,"dist"),html=await readFile(join(dist,"tools/synthetic-counter/index.html"),"utf8");
assert.ok(html.includes("data-tool-version"));assert.ok(html.includes("合成試験fixture"));
assert.ok(html.includes(chosen.sourceCommit));assert.ok(!html.includes("固定したソースを見る"));
// Same production hash/CSP generator; fixture has two independent instances intentionally.
const analysis=analyzeBuiltHtml([{path:"tools/synthetic-counter/index.html",html}],[{route:"/tools/synthetic-counter/",contentId:"bca48f98-c89a-457f-84d8-168f941fe469",
 moduleId:"synthetic-counter",componentId:"synthetic-counter-react-v1",hydration:"load"}]);
assert.deepEqual(analysis.errors,[]);
await writeFile(join(dist,"_headers"),renderSecurityHeaderArtifact({scriptHashes:analysis.scriptHashes,styleHashes:analysis.styleHashes,toolRoutes:["/tools/synthetic-counter/"]}));
const distributed:string[]=[];
async function collect(folder:string,prefix=""):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=prefix+entry.name;if(entry.isDirectory())await collect(join(folder,entry.name),path+"/");else distributed.push(path);
}}
await collect(dist);
assert.ok(distributed.some(path=>/^_astro\/.*\.js$/u.test(path)));
async function assertPrivate(folder:string):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
 const path=join(folder,entry.name);if(entry.isDirectory())await assertPrivate(path);else if(/\.(html|m?js|json|xml|css)$/u.test(path))
   assert.ok(!(await readFile(path,"utf8")).includes("SYNTHETIC_BROWSER_TOOL_ONLY"),"Synthetic tool must not enter production dist");
}}
await assertPrivate(join(root,"apps/site/dist"));
await writeFile(join(temporary,"receipt.json"),JSON.stringify({schemaVersion:1,scope:generated?"generated-template-fixture-only":"local-synthetic-fixture-only",pins,selected:chosen.releaseId,
  sourceBuildsPerVersion:2,lockSha256:toolHash(await readFile(join(host,"package-lock.json"))),dist:relative(root,dist),files:distributed.sort()},null,2)+"\n");
console.log("Synthetic browser Tool fixture built from actual local Git commits, two identical builds/version, append/update/verified rollback; production dist unchanged");
