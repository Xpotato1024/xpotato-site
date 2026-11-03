import {createBrowserToolSource} from "../../tools/authoring/browser-tool-source.js";
import {execFileSync} from "node:child_process";
import {cp,mkdir,readFile,writeFile,rm,readdir} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import type {BrowserToolReview,BrowserToolPin} from "@xpotato/content-contracts";
import {inspectToolArtifact,inspectToolSource,adoptToolRelease,selectToolRelease} from "../../packages/site-validators/src/browser-tools/browser-tool-adoption.js";

async function buildCleanFixture(sourceRoot:string,commit:string,work:string,output:string):Promise<void>{
  const snapshot=await inspectToolSource(sourceRoot,commit);
  await mkdir(work);
  for(const [path,bytes] of snapshot.files){await mkdir(dirname(join(work,path)),{recursive:true});await writeFile(join(work,path),bytes,{flag:"wx"});}
  // Only the repository-owned synthetic builder, in a new source directory for every build.
  execFileSync(process.execPath,[snapshot.files.has("scripts/build.mjs")?"scripts/build.mjs":"build.mjs",output],{cwd:work,stdio:"pipe"});
}

export async function createToolFixture(root:string,{generated=false,bounded=false,toolId='synthetic-counter',version}:{generated?:boolean;bounded?:boolean;toolId?:string;version?:string}={}):Promise<{sourceRoot:string;artifactRoot:string;vendorRoot:string;review:BrowserToolReview;pin:BrowserToolPin}> {
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(toolId))throw Error('Safe synthetic tool ID required');
  const sourceRoot=join(root,"source"),artifactRoot=join(root,"build-a"),vendorRoot=join(root,"vendor");
  await mkdir(root,{recursive:true});
  if(generated&&bounded)throw Error("Choose one fixture");
  const template=resolve(dirname(fileURLToPath(import.meta.url)),bounded?"../../packages/site-validators/fixtures/bounded-browser-tool":"../../packages/site-validators/fixtures/synthetic-browser-tool");
  if(generated){
    await createBrowserToolSource({directory:sourceRoot,toolId:"synthetic-counter",title:"試験用文字列",license:"MIT",licenseFile:join(template,"LICENSE"),noticeFile:join(template,"NOTICE")});
    const lock=JSON.parse(await readFile(join(template,"package-lock.json"),"utf8"));
    lock.version=lock.packages[""].version="0.1.0";await writeFile(join(sourceRoot,"package-lock.json"),JSON.stringify(lock,null,2)+"\n");
  }else {
    await cp(template,sourceRoot,{recursive:true});
    // Assemble two independent synthetic source repos with the actual template
    // font preparer, not a second hand-maintained implementation.
    await cp(resolve(dirname(fileURLToPath(import.meta.url)),'../../templates/browser-tool-sync/src/ui/prepare-fonts.mjs'),join(sourceRoot,'src/prepare-fonts.mjs'));
  }
  if(toolId!=='synthetic-counter'){
    async function rebrand(dir:string){for(const e of await readdir(dir,{withFileTypes:true})){
      const path=join(dir,e.name);if(e.isDirectory())await rebrand(path);else if(e.isFile()){
        const old=await readFile(path,'utf8');await writeFile(path,old.replaceAll('synthetic-counter',toolId));
      }else throw Error('Synthetic fixture must contain only regular files');
    }}await rebrand(sourceRoot);
  }
  if(version){
    const pkg=JSON.parse(await readFile(join(sourceRoot,'package.json'),'utf8')),lock=JSON.parse(await readFile(join(sourceRoot,'package-lock.json'),'utf8'));
    pkg.version=lock.version=lock.packages[''].version=version;
    await writeFile(join(sourceRoot,'package.json'),JSON.stringify(pkg,null,2)+'\n');await writeFile(join(sourceRoot,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
  }
  const git=(...args:string[])=>execFileSync("git",["-C",sourceRoot,...args],{encoding:"utf8",env:{...process.env,GIT_AUTHOR_DATE:"2026-10-15T00:00:00Z",GIT_COMMITTER_DATE:"2026-10-15T00:00:00Z"}});
  git("init","--quiet");git("config","core.autocrlf","false");git("config","user.name","Synthetic Fixture");git("config","user.email","fixture@example.invalid");
  git("add",".");git("-c","commit.gpgsign=false","commit","--quiet","-m","Synthetic local source fixture");
  const commit=git("rev-parse","HEAD").trim();
  // This is the repository-owned fixture builder only. Adoption never executes an arbitrary source build.
  await buildCleanFixture(sourceRoot,commit,join(root,"source-build-a"),artifactRoot);
  await buildCleanFixture(sourceRoot,commit,join(root,"different-source-build-b"),join(root,"build-b"));
  const artifact=await inspectToolArtifact(artifactRoot),repeat=await inspectToolArtifact(join(root,"build-b"));
  if(artifact.artifactSha256!==repeat.artifactSha256)throw Error("Fixture builds are not byte reproducible");
  const source=await inspectToolSource(sourceRoot,commit);
  const review:BrowserToolReview={schemaVersion:1,source:{kind:"local-fixture",name:"synthetic-browser-tool"},sourceCommit:commit,
    sourceTreeSha256:source.sourceTreeSha256,lockSha256:source.lockSha256,manifestSha256:artifact.manifestSha256,
    artifactSha256:artifact.artifactSha256,reproducibleArtifactSha256:[artifact.artifactSha256,repeat.artifactSha256],...(bounded?{runtimeReview:{fixedEmbeddedAssets:true,finiteResources:true,cancelUnmountRetirement:true,noComputeNetwork:true,hostSeoOwnership:true} as const}:{}),
    review:{reviewer:"repository-owned synthetic fixture harness (not external release review)",scope:"fixture-only",decision:"admit"}};
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
  await buildCleanFixture(first.sourceRoot,commit,join(root,"update-source-a"),artifactRoot);
  const second=join(root,"build-update-repeat");
  await buildCleanFixture(first.sourceRoot,commit,join(root,"different-update-source-b"),second);
  const artifact=await inspectToolArtifact(artifactRoot),repeat=await inspectToolArtifact(second),source=await inspectToolSource(first.sourceRoot,commit);
  if(artifact.artifactSha256!==repeat.artifactSha256)throw Error("Update build mismatch");
  const review={...first.review,sourceCommit:commit,sourceTreeSha256:source.sourceTreeSha256,lockSha256:source.lockSha256,
    manifestSha256:artifact.manifestSha256,artifactSha256:artifact.artifactSha256,reproducibleArtifactSha256:[artifact.artifactSha256,repeat.artifactSha256] as [string,string]};
  const pin=await adoptToolRelease({...first,artifactRoot,review,releaseId:"fixture-v2"});
  await selectToolRelease(first.vendorRoot,[first.pin,pin],"synthetic-counter",pin.releaseId,true);
  await selectToolRelease(first.vendorRoot,[first.pin,pin],"synthetic-counter",first.pin.releaseId,true);
  return pin;
}
