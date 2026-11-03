import {readFile,writeFile,mkdir,lstat,rm,readdir,open,rename,mkdtemp} from "node:fs/promises";
import ts from 'typescript';
import {randomUUID} from "node:crypto";
import {join,dirname,resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {parse as parseYaml} from "yaml";
import {browserToolReviewSchema,browserToolPinSchema,type BrowserToolPin} from "@xpotato/content-contracts";
import {adoptToolRelease,verifyToolCandidate,verifyToolPin,noToolLinks,toolHash} from "../../packages/site-validators/src/browser-tools/browser-tool-adoption.js";
import {assertPrimePublicAdmission} from "../../packages/site-validators/src/browser-tools/prime/prime-public-admission.js";
import {browserToolPlacementSchema,manualPrimeMigrationHead,manualPrimeReleaseId,configuration,installation,configPath,generatedRoot,json,optional,load,reviewPath,render,generatedFiles,checkIdentity,checkBrowserToolInstallations} from "../../packages/site-validators/src/browser-tools/browser-tool-installation.js";
async function installBrowserToolUnlocked(input:{siteRoot:string;sourceRoot:string;artifactRoot:string;review:unknown;releaseId:string;placement:unknown;apply?:boolean;replaceArtifact?:string}){
 const root=resolve(input.siteRoot);await noToolLinks(root);await noToolLinks(join(root,configPath));
 const placement=browserToolPlacementSchema.parse(input.placement),before=await load(root);
 const candidate=await verifyToolCandidate(input),pin=browserToolPinSchema.parse({...candidate.pinFields,releaseId:input.releaseId});
 if(pin.source.kind!=="github")throw Error("Public installer requires reviewed GitHub source");
 const prior=before.installations.find(x=>x.pin.toolId===pin.toolId);
 if(prior){
  if("migration" in prior)throw Error("Preserved published Prime requires a separate reviewed release/content migration");
  if(input.replaceArtifact!==prior.pin.artifactSha256)throw Error("Update requires exact --replace-artifact of the selected release");
  if(placement.contentId!==prior.placement.contentId||placement.slug!==prior.placement.slug)throw Error("Update must preserve ContentId/route; route migration requires redirects");
  if(pin.releaseId===prior.pin.releaseId)throw Error("Update requires a fresh immutable releaseId");
 }else if(input.replaceArtifact)throw Error("No managed prior installation to replace");
 const next=configuration.parse({schemaVersion:1,installations:[...before.installations.filter(x=>x.pin.toolId!==pin.toolId),{pin,placement}]});
 await checkBrowserToolInstallations(root);await checkIdentity(root,next);
 const existingPage=join(root,"apps/site/src/content/tools",placement.slug+".mdx");
 if(!prior&&(await optional(existingPage)!==null||await optional(join(root,"apps/site/src/content/tools",placement.slug+".md"))!==null))throw Error("Placement already exists; explicit migration required");
 const pkgPath="apps/site/package.json",pkg=JSON.parse(await readFile(join(root,pkgPath),"utf8"));
 if(pkg.dependencies?.[pin.packageName]&&(!prior||pkg.dependencies[pin.packageName]!=="file:../../vendor/browser-tools/"+prior.pin.toolId+"/"+prior.pin.releaseId))throw Error("Dependency already exists; explicit migration required");
 const review=browserToolReviewSchema.parse(input.review),durable=reviewPath(pin),reviewText=json(review),oldReview=await optional(join(root,durable));
 if(oldReview!==null&&oldReview!==reviewText)throw Error("Immutable review path already exists with different bytes");
 const metadataFiles=[configPath,pkgPath,"package-lock.json",durable],previous=new Map<string,string|null>();
 for(const path of new Set([...render(next).keys(),...metadataFiles]))previous.set(path,await optional(join(root,path)));
 const plan={metadataFiles,adoptionDirectory:"vendor/browser-tools/"+pin.toolId+"/"+pin.releaseId,toolId:pin.toolId,releaseId:pin.releaseId,artifactSha256:pin.artifactSha256,route:"/tools/"+placement.slug+"/",draft:true,source:pin.source,
  generatedFiles:[...render(next).keys()],network:false,publication:false,
  nextBuildStep:"npm ci --ignore-scripts (use --offline when the reviewed dependencies are cached), then normal site validation/build",
  capabilityGate:"New capability routes remain draft. Production CSP/publication requires separate reviewed approval."};
 if(!input.apply)return plan;
 // Fixed local artifact adoption only: no source build, remote download or package scripts.
 await adoptToolRelease({...input,review:input.review as never,vendorRoot:join(root,"vendor/browser-tools")});
 const files=await generatedFiles(root,next);files.set(configPath,json(next));
 files.set(durable,reviewText);
 pkg.dependencies[pin.packageName]="file:../../vendor/browser-tools/"+pin.toolId+"/"+pin.releaseId;files.set(pkgPath,json(pkg));
 for(const [path,value]of previous)if(await optional(join(root,path))!==value)throw Error("Installation preimage changed; preserve user edits and re-plan: "+path);
 // Capture all preimages before mutating. Rollback metadata on npm/check failure; immutable adopted release remains unselected.
 try{
  for(const[path,text]of files){await mkdir(dirname(join(root,path)),{recursive:true});await noToolLinks(dirname(join(root,path)));await writeFile(join(root,path),text);}
  execFileSync("npm",["install","--package-lock-only","--ignore-scripts","--offline","--no-audit","--no-fund"],{cwd:root,stdio:"pipe",timeout:60000});
  await checkBrowserToolInstallations(root);
 }catch(error){for(const[path,text]of previous)if(text===null)await rm(join(root,path),{force:true});else await writeFile(join(root,path),text);throw error;}
 return {...plan,applied:true,lockSha256:toolHash(await readFile(join(root,"package-lock.json")))};
}
export async function initializeBrowserToolInstallations(root:string){
 const c=await load(root);for(const[path,text]of await generatedFiles(root,c)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);}
}

export async function installBrowserTool(input:Parameters<typeof installBrowserToolUnlocked>[0]){
 if(!input.apply)return installBrowserToolUnlocked(input);
 const dir=await installerDirectory(resolve(input.siteRoot));
 const lockPath=join(dir,"browser-tool-install.lock"),lock=await open(lockPath,"wx");
 try{return await installBrowserToolUnlocked(input);}finally{await lock.close();await rm(lockPath);}
}

/** Explicit release-only update of the preserved public Prime. The ordinary
 * installer continues to reject published entries. No page/CSP/provider change.
 */
export async function updatePublishedPrimeRelease(input:{siteRoot:string;sourceRoot:string;artifactRoot:string;review:unknown;releaseId:string;replaceArtifact:string;apply?:boolean}){
 const root=resolve(input.siteRoot);
 const run=async()=>{
  await checkBrowserToolInstallations(root);
  const configText=await readFile(join(root,configPath),'utf8'),before=configuration.parse(JSON.parse(configText)),prior=before.installations.find(item=>item.pin.toolId==='prime-factorizer');
  if(!prior||!('migration' in prior))throw Error('Preserved published Prime installation required');
  if(input.replaceArtifact!==prior.pin.artifactSha256)throw Error('Exact selected Prime artifact required');
  if(input.releaseId===prior.pin.releaseId)throw Error('Fresh immutable Prime releaseId required');
  const review=browserToolReviewSchema.parse(input.review);
  const pin=browserToolPinSchema.parse({schemaVersion:1,toolId:'prime-factorizer',packageName:'@xpotato-tool/prime-factorizer',releaseId:input.releaseId,
   source:review.source,sourceCommit:review.sourceCommit,sourceTreeSha256:review.sourceTreeSha256,lockSha256:review.lockSha256,
   manifestSha256:review.manifestSha256,artifactSha256:review.artifactSha256,reviewSha256:toolHash(JSON.stringify(review))});
  // This explicit operation materializes one reviewed exact admission. It is
  // not a general public capability/CSP grant.
  assertPrimePublicAdmission(pin,review,pin);
  const next=configuration.parse({schemaVersion:1,installations:before.installations.map(item=>item===prior?{...item,pin}:item)});
  const pkgPath='apps/site/package.json',pkgText=await readFile(join(root,pkgPath),'utf8'),pkg=JSON.parse(pkgText);
  if(pkg.dependencies?.[pin.packageName]!=='file:../../vendor/browser-tools/'+prior.pin.toolId+'/'+prior.pin.releaseId)throw Error('Prime dependency preimage differs');
  const releasePath='apps/site/src/content-registry/interactive/releases.ts',releases=await optional(join(root,releasePath));
  const needle='...generatedReleases,';
  if(!releases||releases.split(needle).length!==2||releases.includes('"releaseId": "'+prior.pin.releaseId+'"'))throw Error('Historical release registry preimage differs');
  if(releases.includes('"releaseId": "'+pin.releaseId+'"'))throw Error('Fresh immutable Prime releaseId required; history collision');
  const historical=releases.replace(needle,()=>needle+'\n'+JSON.stringify(prior.pin,null,2)+',');
  const durable=reviewPath(pin),reviewText=json(review),existing=await optional(join(root,durable));
  if(existing!==null&&existing!==reviewText)throw Error('Immutable review path differs');
  const paths=[...render(next).keys(),configPath,pkgPath,'package-lock.json',primeAdmission,releasePath,durable];
  const previous=new Map<string,string|null>();
  for(const path of new Set(paths))previous.set(path,await optional(join(root,path)));
  if(previous.get(configPath)!==configText||previous.get(pkgPath)!==pkgText||previous.get(releasePath)!==releases||previous.get(durable)!==existing)throw Error('Prime update derivation preimage changed');
  for(const[path,text]of await generatedFiles(root,before))if(previous.get(path)!==text)throw Error('Generated Prime preimage changed: '+path);
  const plan={toolId:pin.toolId,fromReleaseId:prior.pin.releaseId,releaseId:pin.releaseId,artifactSha256:pin.artifactSha256,
   contentId:prior.placement.contentId,route:'/tools/prime-factorizer/',draft:false,contentChanged:false,network:false,publication:false,
   generatedFiles:[...render(next).keys()],metadataFiles:[configPath,pkgPath,'package-lock.json',primeAdmission,releasePath,durable],
   nextBuildStep:'npm ci --ignore-scripts, then Site validation/build and actual dist acceptance'};
  if(!input.apply){const checked=await verifyToolCandidate(input);if(json(browserToolPinSchema.parse({...checked.pinFields,releaseId:input.releaseId}))!==json(pin))throw Error('Reviewed Prime candidate identity differs');return plan;}
  const adopted=await adoptToolRelease({...input,review,vendorRoot:join(root,'vendor/browser-tools')});
  if(json(adopted)!==json(pin))throw Error('Adopted Prime identity differs; unselected artifact retained');
  const files=await generatedFiles(root,next);
  files.set(configPath,json(next));files.set(primeAdmission,json(pin));files.set(durable,reviewText);files.set(releasePath,historical);
  pkg.dependencies[pin.packageName]='file:../../vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;files.set(pkgPath,json(pkg));
  for(const [path,value]of previous)if(await optional(join(root,path))!==value)throw Error('Prime update preimage changed: '+path);
  try{
   // Generate npm's lock in isolation. npm never writes into the user's checkout.
   const stage=await mkdtemp(join(await installerDirectory(root),'prime-lock-'));
   try{
    const oldLock=JSON.parse(previous.get('package-lock.json')!);
    const manifests=new Set(['package.json',...Object.keys(oldLock.packages).filter(p=>p&&!p.includes('node_modules')).map(p=>p+'/package.json'),'vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId+'/package.json']);
    for(const path of manifests){const text=files.get(path)??await readFile(join(root,path),'utf8');await mkdir(dirname(join(stage,path)),{recursive:true});await writeFile(join(stage,path),text);}
    await writeFile(join(stage,'package-lock.json'),previous.get('package-lock.json')!);
    const npm=process.env.npm_execpath;
    if(!npm)throw Error('Run the update through the pinned npm entrypoint');
    execFileSync(process.execPath,[npm,'install','--package-lock-only','--ignore-scripts','--offline','--no-audit','--no-fund'],{cwd:stage,stdio:'pipe',timeout:60000});
    files.set('package-lock.json',await readFile(join(stage,'package-lock.json'),'utf8'));
   }finally{await rm(stage,{recursive:true,force:true});}
   for(const[path,text]of files){
    const target=join(root,path),temporary=join(dirname(target),'.browser-tool-transfer-'+randomUUID());
    await mkdir(dirname(target),{recursive:true});await noToolLinks(dirname(target));
    try{
     await writeFile(temporary,text,{flag:'wx'});const handle=await open(temporary,'r+');try{await handle.sync();}finally{await handle.close();}
     if(await optional(target)!==previous.get(path))throw Error('Prime update preimage changed: '+path);
     await rename(temporary,target);
    }finally{await rm(temporary,{force:true});}
   }
   await checkBrowserToolInstallations(root);
  }catch(error){
   // Restore only bytes owned by this operation; preserve concurrent user edits.
   for(const[path,text]of previous){const current=await optional(join(root,path));if(current!==text&&current!==files.get(path))throw Error('Prime update interrupted; preserve edits and inspect: '+path,{cause:error});}
   for(const[path,text]of previous){
    const target=join(root,path),current=await optional(target);if(current===text)continue;
    if(current!==files.get(path))throw Error('Prime rollback interrupted; preserve edits and inspect: '+path,{cause:error});
    if(text===null)await rm(target,{force:true});else{
     const temporary=join(dirname(target),'.browser-tool-transfer-'+randomUUID());
     try{await writeFile(temporary,text,{flag:'wx'});if(await optional(target)!==current)throw Error('Prime rollback preimage changed: '+path);await rename(temporary,target);}finally{await rm(temporary,{force:true});}
    }
   }
   throw error;
  }
  return {...plan,applied:true,lockSha256:toolHash(await readFile(join(root,'package-lock.json')))};
 };
 if(!input.apply)return run();
 const dir=await installerDirectory(root),path=join(dir,'browser-tool-install.lock'),lock=await open(path,'wx');
 try{return await run();}finally{await lock.close();await rm(path);}
}

async function installerDirectory(root:string){
 await noToolLinks(root);const dir=join(root,".local");
 try{await noToolLinks(dir);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 await mkdir(dir,{recursive:true});await noToolLinks(dir);return dir;
}

const interactiveRoot="apps/site/src/content-registry/interactive/";
const primePage="apps/site/src/content/tools/prime-factorizer.mdx";
const primeAdmission="config/browser-tools/prime-public-admission.json";

/** Ownership transfer of the already adopted release. No builder, npm or new release is involved. */
async function manualPrimeTransfer(root:string,fromHead:string){
 if(fromHead!==manualPrimeMigrationHead)throw Error("Exact approved manual Prime baseline required");
 await noToolLinks(root);
 const git=(...args:string[])=>execFileSync("git",["-c","core.fsmonitor=false","-C",root,...args],{encoding:"utf8",maxBuffer:10_000_000,env:{...process.env,GIT_OPTIONAL_LOCKS:"0",GIT_NO_REPLACE_OBJECTS:"1"}});
 if(resolve(git("rev-parse","--show-toplevel").trim())!==root)throw Error("Independent site checkout root required");
 git("merge-base","--is-ancestor",fromHead,"HEAD");
 const baseline=(path:string)=>git("show",fromHead+":"+path);
 const page=baseline(primePage),metadata=parseYaml(page.split(/^---\s*$/mu)[1]??"");
 const source=baseline(interactiveRoot+"releases.ts"),ast=ts.createSourceFile("releases.ts",source,ts.ScriptTarget.Latest,true);
 let pins:BrowserToolPin[]|undefined;
 const visit=(node:ts.Node):void=>{
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==="browserToolReleases"&&node.initializer&&ts.isCallExpression(node.initializer)){
   const array=node.initializer.arguments[0];
   if(!array||!ts.isArrayLiteralExpression(array))throw Error("Unknown manual release registry shape");
   pins=array.elements.filter(item=>!ts.isSpreadElement(item)).map(item=>browserToolPinSchema.parse(JSON.parse(item.getText(ast))));
  }ts.forEachChild(node,visit);
 };visit(ast);
 const pin=pins?.find(value=>value.toolId==="prime-factorizer"&&value.releaseId===manualPrimeReleaseId);
 const expectedReleases=["v0-1-0","v0-1-1","v0-1-2",manualPrimeReleaseId];
 if(!pin||pins?.length!==expectedReleases.length||!expectedReleases.every(id=>pins!.some(value=>value.toolId==="prime-factorizer"&&value.releaseId===id)))throw Error("Expected selected and historical Prime releases");
 const beforeConfig=configuration.parse(JSON.parse(baseline(configPath)));
 if(beforeConfig.installations.length)throw Error("Manual transfer requires its exact empty baseline");
 const item=installation.parse({pin,placement:{contentId:metadata.id,slug:"prime-factorizer",title:metadata.title,description:metadata.description,
  category:metadata.category,tags:metadata.tags,pubDate:metadata.pubDate,hydration:"visible",draft:metadata.draft},
  migration:{kind:"manual-prime-v1",fromHead,contentSha256:toolHash(page)}});
 const next=configuration.parse({schemaVersion:1,installations:[item]});
 // Read-only dependencies must still be the publicly admitted exact release and page.
 const guards=[primePage,primeAdmission,reviewPath(pin),"apps/site/package.json","package-lock.json"];
 for(const path of guards)if(await optional(join(root,path))!==baseline(path))throw Error("Manual migration dependency preimage changed: "+path);
 if(await optional(join(root,"apps/site/src/content/tools/prime-factorizer.md"))!==null)throw Error("Prime route collision");
 assertPrimePublicAdmission(pin,JSON.parse(baseline(reviewPath(pin))),JSON.parse(baseline(primeAdmission)));
 await verifyToolPin(join(root,"vendor/browser-tools"),pin);
 const files=await generatedFiles(root,next);
 files.set(configPath,json(next));
 files.set(interactiveRoot+"index.ts",'import {generatedModules,generatedBindings} from "./generated/records.js";\nimport {toolBindingRecordSchema} from "@xpotato/content-contracts";\n\nexport const interactiveModuleRegistry = Object.freeze({...generatedModules});\nexport const toolBindings = Object.freeze(generatedBindings.map(value=>toolBindingRecordSchema.parse(value)));\n');
 files.set(interactiveRoot+"component-ids.ts",'import {generatedComponentIds} from "./generated/records.js";\nexport const interactiveComponentIds = generatedComponentIds;\nexport type InteractiveComponentId = (typeof interactiveComponentIds)[number];\n');
 files.set(interactiveRoot+"component-imports.ts",'import {generatedComponents} from "./generated/components.js";\nimport type {InteractiveComponentId} from "./component-ids.js";\n\nexport const interactiveComponentImports = Object.freeze(generatedComponents satisfies Record<InteractiveComponentId, Readonly<Record<"load" | "idle" | "visible" | "media", unknown>>>);\n');
 files.set(interactiveRoot+"manifest-sources.ts",'import {generatedManifestSources} from "./generated/manifests.js";\nexport const browserToolManifestSources: Readonly<Record<string,string>> = Object.freeze({...generatedManifestSources});\n');
 files.set(interactiveRoot+"releases.ts",'import {generatedReleases} from "./generated/records.js";\nimport type {BrowserToolPin} from "@xpotato/content-contracts";\n\n// Historical immutable releases remain available; selection is owned by installations.json.\nexport const browserToolReleases: readonly BrowserToolPin[] = Object.freeze([\n...generatedReleases,\n'+pins!.filter(value=>value.releaseId!==pin.releaseId).map(value=>JSON.stringify(value,null,2)).join(",\n")+'\n]);\n');
 const previous=new Map<string,string>();
 for(const path of files.keys())previous.set(path,baseline(path));
 return {files,previous,guards,baseline,artifactSha256:pin.artifactSha256};
}

export async function migrateManualPrime(input:{siteRoot:string;fromHead:string;apply?:boolean;rollback?:boolean}){
 const root=resolve(input.siteRoot);
 const execute=async()=>{
  const {files,previous,guards,baseline,artifactSha256}=await manualPrimeTransfer(root,input.fromHead);
  const current=new Map<string,string|null>();
  for(const path of files.keys())current.set(path,await optional(join(root,path)));
  const before=[...previous].every(([path,text])=>current.get(path)===text),after=[...files].every(([path,text])=>current.get(path)===text);
  const result={fromHead:input.fromHead,toolId:"prime-factorizer",releaseId:manualPrimeReleaseId,artifactSha256,route:"/tools/prime-factorizer/",publication:false,network:false,
   changedFiles:[...files].filter(([path,text])=>previous.get(path)!==text).map(([path])=>path),preservedFiles:guards,
   rollback:"browser-tools:install -- rollback-manual-prime --from-head "+input.fromHead};
  const assertKnown=async()=>{
   for(const [path,text]of files){const value=await optional(join(root,path));if(value!==text&&value!==previous.get(path))throw Error("Migration preimage changed; preserve edits and inspect: "+path);}
   for(const path of guards)if(await optional(join(root,path))!==baseline(path))throw Error("Migration dependency changed; preserve edits and inspect: "+path);
  };
  const replace=async(path:string,text:string)=>{
   const target=join(root,path),stage=join(dirname(target),".browser-tool-transfer-"+randomUUID());
   await noToolLinks(dirname(target));
   try{
    await writeFile(stage,text,{flag:"wx"});
    const handle=await open(stage,"r+");try{await handle.sync();}finally{await handle.close();}
    const current=await optional(target);
    if(current!==files.get(path)&&current!==previous.get(path))throw Error("Migration preimage changed; preserve edits and inspect: "+path);
    await rename(stage,target);
   }finally{await rm(stage,{force:true});}
  };
  if(input.rollback){
   await assertKnown();
   for(const [path,text]of previous)if(await optional(join(root,path))!==text)await replace(path,text);
   await checkBrowserToolInstallations(root);
   return {...result,status:"rolled-back"};
  }
  if(after){await checkBrowserToolInstallations(root);return {...result,status:"already-migrated",changedFiles:[]};}
  if(!before)throw Error("Manual migration target collision; re-plan or explicitly rollback the interrupted transfer");
  await checkBrowserToolInstallations(root);
  if(!input.apply)return {...result,status:"planned"};
  await assertKnown();
  try{
   for(const [path,text]of files)if(previous.get(path)!==text)await replace(path,text);
   await checkBrowserToolInstallations(root);
  }catch(error){
   // Never overwrite an unexpected edit, even while restoring a failed transfer.
   await assertKnown();
   for(const [path,text]of previous)if(await optional(join(root,path))!==text)await replace(path,text);
   throw error;
  }
  return {...result,status:"applied"};
 };
 if(!input.apply&&!input.rollback)return execute();
 const dir=await installerDirectory(root);
 const lockPath=join(dir,"browser-tool-install.lock"),lock=await open(lockPath,"wx");
 try{return await execute();}finally{await lock.close();await rm(lockPath);}
}
