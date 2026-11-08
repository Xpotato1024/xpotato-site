import {execFileSync} from "node:child_process";
import {afterEach,describe,it,expect} from "vitest";
import {fileSymlink} from "../../../../tests/fixtures/file-symlink.mjs";
import {mkdtemp,rm,readFile,writeFile,symlink,link,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {browserToolManifestSchema} from "@xpotato/content-contracts";
import {adoptToolRelease,inspectToolArtifact,selectToolRelease,verifyToolCandidate,verifyToolPin,toolHash,inspectToolSource} from "./browser-tool-adoption.js";
import {createToolFixture,updateToolFixture} from "../../../../tests/fixtures/browser-tools.js";
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
async function fixture(){const root=await mkdtemp(join(tmpdir(),"browser-tool-"));roots.push(root);return {root,...await createToolFixture(root)};}
describe("fixed browser tool adoption",()=>{
  it('admits the exact reviewed font preparer, never rehashed modified helpers or ordinary document/timer use',async()=>{
    const f=await fixture(),path=join(f.artifactRoot,'prepare-fonts.mjs'),original=await readFile(path),manifestPath=join(f.artifactRoot,'browser-tool.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    for(const suffix of ['\n','\ndocument.body.textContent="changed";','\nsetTimeout(()=>{},1);']){
      const body=Buffer.concat([original,Buffer.from(suffix)]);await writeFile(path,body);
      const changed=structuredClone(manifest),record=changed.files.find((r:{path:string})=>r.path==='prepare-fonts.mjs');record.bytes=body.length;record.sha256=toolHash(body);await writeFile(manifestPath,JSON.stringify(changed));
      await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/Disallowed browser API/);
    }
    await writeFile(path,original);await writeFile(manifestPath,JSON.stringify(manifest));await expect(inspectToolArtifact(f.artifactRoot)).resolves.toBeDefined();
    const ui=await readFile(join(f.artifactRoot,'tool.mjs'),'utf8'),fixed=await readFile(join(f.artifactRoot,'font-text.mjs'),'utf8');
    for(const [relative,bodies]of [
      ['tool.mjs',[ui.replace('prepareFixedFonts(root.current,ok=>','prepareFixedFonts(root.current,"user input",ok=>'),ui+'\nconst alias=prepareFixedFonts;',ui+'\nprepareFixedFonts(null,()=>{});',ui+'\nexport {prepareFixedFonts} from "./prepare-fonts.mjs";',ui.replace('{prepareFixedFonts}','{prepareFixedFonts as alias}'),ui+'\ndocument.fonts.load("1rem x","input");',ui+'\nsetTimeout(()=>{},1);']],
      ['font-text.mjs',['export const fontText=Object.freeze({label:input});','export const fontText=Object.freeze({get label(){return "input"}});',fixed+'\nexport const extra="input";','export const fontText=Object.freeze({label:'+JSON.stringify('x'.repeat(4097))+'});']],
    ] as const){
      for(const body of bodies){await writeFile(join(f.artifactRoot,relative),body);const changed=structuredClone(manifest),record=changed.files.find((r:{path:string})=>r.path===relative);record.bytes=Buffer.byteLength(body);record.sha256=toolHash(body);await writeFile(manifestPath,JSON.stringify(changed));await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow();}
      await writeFile(join(f.artifactRoot,relative),relative==='tool.mjs'?ui:fixed);
    }
    await writeFile(manifestPath,JSON.stringify(manifest));await expect(inspectToolArtifact(f.artifactRoot)).resolves.toBeDefined();
  },20000);
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
  it("reads the original pinned commit rather than replacement objects in a clean-looking checkout",async()=>{
    const f=await fixture(),second=await updateToolFixture(f.root,f);
    const git=(...args:string[])=>execFileSync("git",["-C",f.sourceRoot,...args],{encoding:"utf8"});
    const branch=git("symbolic-ref","HEAD").trim();
    git("update-ref",branch,f.pin.sourceCommit);
    git("replace",f.pin.sourceCommit,second.sourceCommit);
    expect(git("rev-parse","HEAD").trim()).toBe(f.pin.sourceCommit);
    expect(git("status","--porcelain")).toBe("");
    await expect(inspectToolSource(f.sourceRoot,f.pin.sourceCommit)).rejects.toThrow(/clean|bytes/);
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
    for(const path of ["../tool.mjs","/tool.mjs","a/../b.mjs","a\\b.mjs","tool.map","AUX.mjs","a./b.mjs"])
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
  it("rejects symbolic artifact bytes",async(context)=>{
    const f=await fixture(),body=join(f.artifactRoot,"core.mjs"),copy=join(f.root,"copy.mjs");
    await rm(body);await fileSymlink(copy,body,context);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/symlink/);
  },20000);
  it("rejects hardlink artifact bytes and linked vendor parents",async()=>{
    const f=await fixture(),body=join(f.artifactRoot,"core.mjs"),copy=join(f.root,"copy.mjs");
    await link(body,copy);await expect(inspectToolArtifact(f.artifactRoot)).rejects.toThrow(/file/);await rm(copy);
    const linked=join(f.root,"linked");await symlink(f.vendorRoot,linked,process.platform==="win32"?"junction":"dir");
    await expect(verifyToolPin(linked,f.pin)).rejects.toThrow(/links/);
  },20000);
});
