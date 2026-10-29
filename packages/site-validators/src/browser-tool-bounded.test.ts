import {it,expect,afterEach} from "vitest";
import {mkdtemp,rm,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";import {join,resolve} from "node:path";
import {browserToolManifestSchema} from "@xpotato/content-contracts";
import {createToolFixture} from "./browser-tool-fixture.js";
import {inspectToolArtifact,toolHash} from "./browser-tool-adoption.js";
const roots:string[]=[];afterEach(async()=>{for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});});
const runtime={profile:"bounded-browser-v2",network:"none-after-ready",storage:"memory",
 capabilities:{fileInput:false,download:false,clipboard:true,worker:false,wasm:false},
 clipboardPolicy:"user-gesture-write-only",assetMode:"fixed-bundled",maxInputBytes:4096,maxOutputBytes:8192,maxComputeMs:50,
 jobMaxMs:5000,maxWorkers:0,maxWasmBytes:0,maxTransportBytes:0,embeddedWorkerModules:[],embeddedWasmModules:[],workerLoaderModules:[]};
it("generic capability profile admits another tool and enforces finite coherent declarations",async()=>{
 const root=await mkdtemp(join(tmpdir(),"bounded-tool-"));roots.push(root);const f=await createToolFixture(root);
 const original=JSON.parse(await readFile(join(f.artifactRoot,"browser-tool.json"),"utf8"));
 const base={...original,runtime};expect(browserToolManifestSchema.safeParse(base).success).toBe(true);
 for(const r of [{...runtime,maxWorkers:7},{...runtime,maxWorkers:1},{...runtime,jobMaxMs:3600001},{...runtime,maxTransportBytes:-1},
  {...runtime,maxWasmBytes:134217728},{...runtime,capabilities:{...runtime.capabilities,worker:true}},{...runtime,assetMode:"remote"}])
  expect(browserToolManifestSchema.safeParse({...base,runtime:r}).success).toBe(false);
 expect(browserToolManifestSchema.safeParse({...base,license:{...original.license,spdx:"AGPL-3.0-only"}}).success).toBe(false);
 expect(browserToolManifestSchema.safeParse({...base,license:{...original.license,spdx:"AGPL-3.0-only",additional:["SOURCE_OFFER.md","THIRD_PARTY_NOTICES.md"]}}).success).toBe(true);
 const path=join(f.artifactRoot,"core.mjs");
 async function check(body:string,caps=runtime.capabilities){
  await writeFile(path,body);const m=structuredClone(base);m.runtime={...runtime,capabilities:caps,maxWorkers:caps.worker?2:0,maxTransportBytes:caps.worker?1048576:0,maxWasmBytes:caps.wasm?134217728:0};
  const record=m.files.find((x:{path:string})=>x.path==="core.mjs");record.bytes=Buffer.byteLength(body);record.sha256=toolHash(body);
  await writeFile(join(f.artifactRoot,"browser-tool.json"),JSON.stringify(m));return inspectToolArtifact(f.artifactRoot);
 }
 const cssPath=base.integration.styles[0],cssOriginal=await readFile(join(f.artifactRoot,cssPath),'utf8');
 for(const [css,allowed]of [["/* scoped explanation */\n"+cssOriginal,true],['.bt-synthetic-counter { content:"/*"; } body { color:red; } .bt-synthetic-counter { content:"*/"; }',false],['/* unclosed',false]] as const){
  const m=structuredClone(base),record=m.files.find((x:{path:string})=>x.path===cssPath);record.bytes=Buffer.byteLength(css);record.sha256=toolHash(css);
  await writeFile(join(f.artifactRoot,cssPath),css);await writeFile(join(f.artifactRoot,'browser-tool.json'),JSON.stringify(m));
  if(allowed)await expect(inspectToolArtifact(f.artifactRoot)).resolves.toBeDefined();else await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();
 }
 await writeFile(join(f.artifactRoot,cssPath),cssOriginal);
 await expect(check('export function convert(x){ return x; }')).resolves.toBeDefined();
 await expect(check('export function convert(x){ return Reflect.ownKeys(x); }')).resolves.toBeDefined();
 for(const body of ['export function convert(x){ return Reflect.get(x,"secret"); }','export function convert(x){ return Reflect["ownKeys"](x); }','const alias=Reflect; export function convert(x){return alias.ownKeys(x);}','export function convert(x){return x.constructor;}'])await expect(check(body)).rejects.toThrow();
 await expect(check('export function convert(){ return new Worker("./core.mjs"); }',{...runtime.capabilities,worker:false})).rejects.toThrow();
 await expect(check('export function convert(){ return WebAssembly; }',{...runtime.capabilities,wasm:false})).rejects.toThrow(/capability/);
 await expect(check('export function convert(){ return navigator.clipboard; }',{...runtime.capabilities,clipboard:false})).rejects.toThrow(/capability/);
 for(const body of ['export function convert(){ return fetch("/leak"); }','export function convert(){ document.title="input"; }','export function convert(){ return navigator.clipboard.readText(); }','export function convert(){ return globalThis["Worker"]; }','export function convert(){ return navigator["clipboard"]; }','export function convert(){ return import("https://remote.invalid/a.mjs"); }'])
  await expect(check(body)).rejects.toThrow();
},20000);
it("the immutable public v0.1.0 still validates with its dedicated legacy profile",async()=>{
 const manifest=await inspectToolArtifact(resolve("vendor/browser-tools/prime-factorizer/v0-1-0"));
 expect("profile" in manifest.manifest.runtime&&manifest.manifest.runtime.profile).toBe("prime-factorizer-async-v1");
});

it("embedded Worker and empty WASM fixture is reachable, declared and checked without a remote loader",async()=>{
 const root=await mkdtemp(join(tmpdir(),"bounded-positive-"));roots.push(root);
 const f=await createToolFixture(root,{bounded:true});const good=await inspectToolArtifact(f.artifactRoot);
 expect(good.manifest.runtime).toMatchObject({profile:"bounded-browser-v2",embeddedWorkerModules:["worker-source.mjs"],embeddedWasmModules:["worker-source.mjs"]});
 const workerPath=join(f.artifactRoot,'worker-source.mjs'),workerOriginal=await readFile(workerPath,'utf8'),manifestOriginal=await readFile(join(f.artifactRoot,'browser-tool.json'),'utf8');
 for(const body of ["export const WORKER_SOURCE='fe'+'tch(\"https://example.invalid\")';", "import {thing} from './core.mjs'; export const WORKER_SOURCE=thing.toString();"]){
  const m=JSON.parse(manifestOriginal),record=m.files.find((x:{path:string})=>x.path==='worker-source.mjs');record.bytes=Buffer.byteLength(body);record.sha256=toolHash(body);
  await writeFile(workerPath,body);await writeFile(join(f.artifactRoot,'browser-tool.json'),JSON.stringify(m));await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();
 }
 await writeFile(workerPath,workerOriginal);await writeFile(join(f.artifactRoot,'browser-tool.json'),manifestOriginal);
 const path=join(f.artifactRoot,"loader.mjs"),original=JSON.parse(await readFile(join(f.artifactRoot,"browser-tool.json"),"utf8"));
 for(const body of ['export function makeWorker(){return new Worker("https://remote.invalid/w.mjs");}','export function makeWorker(){return globalThis["Worker"];}']){
  await writeFile(path,body);const m=structuredClone(original),file=m.files.find((x:{path:string})=>x.path==="loader.mjs");
  file.bytes=Buffer.byteLength(body);file.sha256=toolHash(body);await writeFile(join(f.artifactRoot,"browser-tool.json"),JSON.stringify(m));
  await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();
 }
},20000);
