import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import type {BrowserToolReview,BrowserToolPin} from "@xpotato/content-contracts";
import {inspectToolArtifact,inspectToolSource,adoptToolRelease,selectToolRelease} from "./browser-tool-adoption.js";

export async function createToolFixture(root:string):Promise<{sourceRoot:string;artifactRoot:string;vendorRoot:string;review:BrowserToolReview;pin:BrowserToolPin}> {
  const sourceRoot=join(root,"source"),artifactRoot=join(root,"build-a"),vendorRoot=join(root,"vendor");
  await mkdir(root,{recursive:true});
  await cp(resolve(dirname(fileURLToPath(import.meta.url)),"../fixtures/synthetic-browser-tool"),sourceRoot,{recursive:true});
  const git=(...args:string[])=>execFileSync("git",["-C",sourceRoot,...args],{encoding:"utf8",env:{...process.env,GIT_AUTHOR_DATE:"2026-10-15T00:00:00Z",GIT_COMMITTER_DATE:"2026-10-15T00:00:00Z"}});
  git("init","--quiet");git("config","core.autocrlf","false");git("config","user.name","Synthetic Fixture");git("config","user.email","fixture@example.invalid");
  git("add",".");git("-c","commit.gpgsign=false","commit","--quiet","-m","Synthetic local source fixture");
  const commit=git("rev-parse","HEAD").trim();
  // This is the repository-owned fixture builder only. Adoption never executes an arbitrary source build.
  for(const output of [artifactRoot,join(root,"build-b")])
    execFileSync(process.execPath,["build.mjs",output],{cwd:sourceRoot,stdio:"pipe"});
  const artifact=await inspectToolArtifact(artifactRoot),repeat=await inspectToolArtifact(join(root,"build-b"));
  if(artifact.artifactSha256!==repeat.artifactSha256)throw Error("Fixture builds are not byte reproducible");
  const source=await inspectToolSource(sourceRoot,commit);
  const review:BrowserToolReview={schemaVersion:1,source:{kind:"local-fixture",name:"synthetic-browser-tool"},sourceCommit:commit,
    sourceTreeSha256:source.sourceTreeSha256,lockSha256:source.lockSha256,manifestSha256:artifact.manifestSha256,
    artifactSha256:artifact.artifactSha256,reproducibleArtifactSha256:[artifact.artifactSha256,repeat.artifactSha256],review:{reviewer:"repository-owned synthetic fixture harness (not external release review)",scope:"fixture-only",decision:"admit"}};
  await mkdir(vendorRoot);
  const pin=await adoptToolRelease({sourceRoot,artifactRoot,vendorRoot,review,releaseId:"fixture-v1"});
  return {sourceRoot,artifactRoot,vendorRoot,review,pin};
}
export async function updateToolFixture(root:string,first:Awaited<ReturnType<typeof createToolFixture>>):Promise<BrowserToolPin> {
  const pkg=JSON.parse(await readFile(join(first.sourceRoot,"package.json"),"utf8"));
  pkg.version="1.0.1";await writeFile(join(first.sourceRoot,"package.json"),JSON.stringify(pkg,null,2)+"\n");
  const lock=JSON.parse(await readFile(join(first.sourceRoot,"package-lock.json"),"utf8"));
  lock.version="1.0.1";lock.packages[""].version="1.0.1";await writeFile(join(first.sourceRoot,"package-lock.json"),JSON.stringify(lock,null,2)+"\n");
  const git=(...args:string[])=>execFileSync("git",["-C",first.sourceRoot,...args],{encoding:"utf8",env:{...process.env,GIT_AUTHOR_DATE:"2026-10-15T00:01:00Z",GIT_COMMITTER_DATE:"2026-10-15T00:01:00Z"}});
  git("add",".");git("-c","commit.gpgsign=false","commit","--quiet","-m","Synthetic local release update");
  const commit=git("rev-parse","HEAD").trim(),artifactRoot=join(root,"build-update");
  execFileSync(process.execPath,["build.mjs",artifactRoot],{cwd:first.sourceRoot,stdio:"pipe"});
  const second=join(root,"build-update-repeat");execFileSync(process.execPath,["build.mjs",second],{cwd:first.sourceRoot,stdio:"pipe"});
  const artifact=await inspectToolArtifact(artifactRoot),repeat=await inspectToolArtifact(second),source=await inspectToolSource(first.sourceRoot,commit);
  if(artifact.artifactSha256!==repeat.artifactSha256)throw Error("Update build mismatch");
  const review={...first.review,sourceCommit:commit,sourceTreeSha256:source.sourceTreeSha256,lockSha256:source.lockSha256,
    manifestSha256:artifact.manifestSha256,artifactSha256:artifact.artifactSha256,reproducibleArtifactSha256:[artifact.artifactSha256,repeat.artifactSha256] as [string,string]};
  const pin=await adoptToolRelease({...first,artifactRoot,review,releaseId:"fixture-v2"});
  await selectToolRelease(first.vendorRoot,[first.pin,pin],"synthetic-counter",pin.releaseId,true);
  await selectToolRelease(first.vendorRoot,[first.pin,pin],"synthetic-counter",first.pin.releaseId,true);
  return pin;
}
