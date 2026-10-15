import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,rm,readFile,writeFile,symlink,link,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {browserToolManifestSchema} from "@xpotato/content-contracts";
import {adoptToolRelease,inspectToolArtifact,selectToolRelease,verifyToolCandidate,verifyToolPin,toolHash} from "./browser-tool-adoption.js";
import {createToolFixture,updateToolFixture} from "./browser-tool-fixture.js";
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
async function fixture(){const root=await mkdtemp(join(tmpdir(),"browser-tool-"));roots.push(root);return {root,...await createToolFixture(root)};}
describe("fixed browser tool adoption",()=>{
  it("reproduces source releases twice, appends update, and selects immutable verified rollback",async()=>{
    const first=await fixture(),second=await updateToolFixture(first.root,first);
    expect(second.sourceCommit).not.toBe(first.pin.sourceCommit);expect(second.lockSha256).not.toBe(first.pin.lockSha256);
    expect(await selectToolRelease(first.vendorRoot,[first.pin,second],"synthetic-counter","fixture-v1",true)).toEqual(first.pin);
    expect(await verifyToolPin(first.vendorRoot,second)).toMatchObject({version:"1.0.1"});
    await expect(selectToolRelease(first.vendorRoot,[first.pin],"synthetic-counter","fixture-v1")).rejects.toThrow(/Synthetic/);
    await expect(selectToolRelease(first.vendorRoot,[first.pin],"synthetic-counter","unknown",true)).rejects.toThrow(/Unknown/);
    await expect(selectToolRelease(first.vendorRoot,[first.pin,first.pin],"synthetic-counter","fixture-v1",true)).rejects.toThrow(/duplicate/);
  },20000);
  it("rejects changed source and review hashes without executing a source builder",async()=>{
    const f=await fixture();
    await expect(verifyToolCandidate({...f,review:{...f.review,sourceTreeSha256:"0".repeat(64)}})).rejects.toThrow(/hash/);
    await writeFile(join(f.sourceRoot,"src/core.mjs"),"throw Error('must not execute')");
    await expect(verifyToolCandidate(f)).rejects.toThrow(/clean/);
  },20000);
  it("rejects corrupted bytes and extra unmanifested files",async()=>{
    const f=await fixture();await writeFile(join(f.artifactRoot,"core.mjs"),"tamper");
    await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/hash/);
    const vendor=join(f.vendorRoot,f.pin.toolId,f.pin.releaseId);await writeFile(join(vendor,"extra.mjs"),"");
    await expect(verifyToolPin(f.vendorRoot,f.pin)).rejects.toThrow(/exact-set/);
  },20000);
  it("rejects manifest tampering, unknown capabilities, unsafe paths and source maps",async()=>{
    const f=await fixture(),manifestPath=join(f.artifactRoot,"browser-tool.json");
    const original=JSON.parse(await readFile(manifestPath,"utf8"));
    expect(browserToolManifestSchema.safeParse({...original,runtime:{...original.runtime,capabilities:{...original.runtime.capabilities,remoteScript:true}}}).success).toBe(false);
    for(const path of ["../tool.mjs","/tool.mjs","a/../b.mjs","a\\b.mjs","tool.map"])
      expect(browserToolManifestSchema.safeParse({...original,integration:{...original.integration,entry:path}}).success).toBe(false);
    await writeFile(manifestPath,JSON.stringify({...original,version:"9.0.0"}));
    await expect(verifyToolCandidate(f)).rejects.toThrow();
  },20000);
  it("refuses same releaseId replacement and verifies old bytes at selection",async()=>{
    const f=await fixture();const old=await readFile(join(f.vendorRoot,f.pin.toolId,f.pin.releaseId,"tool.mjs"));
    const second=await updateToolFixture(f.root,f);
    const review={...f.review,sourceCommit:second.sourceCommit,sourceTreeSha256:second.sourceTreeSha256,lockSha256:second.lockSha256,
      manifestSha256:second.manifestSha256,artifactSha256:second.artifactSha256,reproducibleArtifactSha256:[second.artifactSha256,second.artifactSha256] as [string,string]};
    await expect(adoptToolRelease({...f,artifactRoot:join(f.root,"build-update"),review,releaseId:"fixture-v1"})).rejects.toThrow(/Immutable/);
    expect(await readFile(join(f.vendorRoot,f.pin.toolId,f.pin.releaseId,"tool.mjs"))).toEqual(old);
    await writeFile(join(f.vendorRoot,f.pin.toolId,f.pin.releaseId,"tool.mjs"),"tamper");
    await expect(selectToolRelease(f.vendorRoot,[f.pin,second],"synthetic-counter","fixture-v1",true)).rejects.toThrow(/hash/);
  },20000);
  it("inspects rehashed remote JS/imports/maps and unscoped CSS, rather than trusting hashes",async()=>{
    const f=await fixture(),manifestPath=join(f.artifactRoot,"browser-tool.json"),core=await readFile(join(f.artifactRoot,"core.mjs"));
    const original=await readFile(manifestPath,"utf8");
    async function replaced(path:string,body:string){
      await writeFile(join(f.artifactRoot,path),body);
      const manifest=JSON.parse(original),record=manifest.files.find((item:{path:string})=>item.path===path);
      record.bytes=Buffer.byteLength(body);record.sha256=toolHash(body);await writeFile(manifestPath,JSON.stringify(manifest));
    }
    for(const body of ['export function convert(){return fetch("/leak")}','import x from "https://cdn.invalid/x.mjs";export function convert(){return x}',
      'export function convert(){return import("./core.mjs")}','export function convert(){return ({})["constructor"]}',
      'export function convert(){return 1}//# sourceMappingURL=secret.map']){
      await replaced("core.mjs",body);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();
    }
    await writeFile(join(f.artifactRoot,"core.mjs"),core);
    for(const css of ['body { color:red; }','.bt-synthetic-counter {background:url(https://x.invalid/)}',
      '@import "https://x.invalid/";','.bt-synthetic-counter, html {color:red}']){
      await replaced("tool.css",css);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();
    }
  },20000);
  it("rejects symlink/hardlink artifact bytes and vendor parent links",async()=>{
    const f=await fixture(),body=join(f.artifactRoot,"core.mjs"),copy=join(f.root,"copy.mjs");
    await link(body,copy);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/file/);await rm(copy);
    await rm(body);await symlink(copy,body);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/symlink/);
    const linked=join(f.root,"linked");await symlink(f.vendorRoot,linked,process.platform==="win32"?"junction":"dir");
    await expect(verifyToolPin(linked,f.pin)).rejects.toThrow(/links/);
  },20000);
});
