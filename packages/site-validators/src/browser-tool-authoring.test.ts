import {afterEach,it,expect} from "vitest";
import {mkdtemp,rm,readFile,writeFile,cp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {createBrowserToolSource,checkBrowserToolArtifact} from "./browser-tool-authoring.js";
import {inspectToolArtifact} from "./browser-tool-adoption.js";
import {browserToolReactPeers,browserToolSyncDefaults} from "@xpotato/content-contracts";
const roots:string[]=[];
afterEach(async()=>{for(const p of roots.splice(0))await rm(p,{recursive:true,force:true});});
async function setup(){
 const root=await mkdtemp(join(tmpdir(),"browser-authoring-"));roots.push(root);
 const fixture=resolve("packages/site-validators/fixtures/synthetic-browser-tool");
 return {root,input:{directory:join(root,"source"),toolId:"minimal-counter",title:"文字数",license:"MIT",licenseFile:join(fixture,"LICENSE"),noticeFile:join(fixture,"NOTICE")}};
}
it("generates separated source and two independent reproducible artifacts through the canonical inspector",async()=>{
 const {root,input}=await setup();await createBrowserToolSource(input);
 execFileSync(process.execPath,["--test"],{cwd:input.directory,stdio:"pipe"});
 // Builders run only here because these are repository-owned template bytes.
 const copy=join(root,"second-clean-source");await cp(input.directory,copy,{recursive:true});
 for(const [source,out]of [[input.directory,"a"],[copy,"b"]])execFileSync(process.execPath,["scripts/build.mjs",join(root,out!)],{cwd:source,stdio:"pipe"});
 const a=await inspectToolArtifact(join(root,"a")),b=await checkBrowserToolArtifact(join(root,"b"));
 expect(a.artifactSha256).toBe(b.artifactSha256);
 expect(a.manifest.runtime).toEqual(browserToolSyncDefaults);
 expect(JSON.parse(await readFile(join(root,"a/package.json"),"utf8")).peerDependencies).toEqual(browserToolReactPeers);
 expect(a.files.has("tool.mjs")).toBe(true);expect(a.files.has("src/ui/Tool.mjs")).toBe(false);
 expect(await readFile(join(input.directory,"LICENSE"))).toEqual(await readFile(input.licenseFile));
 await expect(createBrowserToolSource(input)).rejects.toThrow(/exist/);
},20000);
it("rejects capability reuse, unsafe identifiers and absent legal input before writing",async()=>{
 const {root,input}=await setup();
 for(const overrides of [{toolId:"../escape"},{toolId:"AUX"},{license:"AGPL-3.0-only"},{licenseFile:join(root,"missing")}])
  await expect(createBrowserToolSource({...input,...overrides})).rejects.toThrow();
 await expect(readFile(join(input.directory,"package.json"))).rejects.toThrow();
});
it("the generated contract remains governed by the current inspector after user edits",async()=>{
 const {root,input}=await setup();await createBrowserToolSource(input);
 const base=JSON.parse(await readFile(join(input.directory,"manifest.base.json"),"utf8"));
 base.runtime.capabilities.worker=true;
 await writeFile(join(input.directory,"manifest.base.json"),JSON.stringify(base));
 execFileSync(process.execPath,["scripts/build.mjs",join(root,"bad")],{cwd:input.directory,stdio:"pipe"});
 await expect(checkBrowserToolArtifact(join(root,"bad"))).rejects.toThrow();
});
