import {readFile,writeFile,mkdir,rm,open,rename,mkdtemp} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {parse as parseYaml} from 'yaml';
import {browserToolReviewSchema,browserToolPinSchema,type BrowserToolPin} from '@xpotato/content-contracts';
import {adoptToolRelease,verifyToolCandidate,noToolLinks,toolHash} from '../../packages/site-validators/src/browser-tools/browser-tool-adoption.js';
import {assertToolPublicAdmission,publicAdmissionPath,readPublicAdmissions} from '../../packages/site-validators/src/browser-tools/public-admission.js';
import {browserToolPlacementSchema,browserToolRegistrationSchema,toolDisplayPolicySchema,configuration,configPath,json,optional,load,reviewPath,render,generatedFiles,checkIdentity,checkBrowserToolInstallations,assertToolDisplayPolicy,toolLicenseText} from '../../packages/site-validators/src/browser-tools/browser-tool-installation.js';

function releaseHistory(source:string){
 const ast=ts.createSourceFile('releases.ts',source,ts.ScriptTarget.Latest,true);let pins:BrowserToolPin[]|undefined;
 function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='browserToolReleases'&&node.initializer){
   const array=ts.isCallExpression(node.initializer)?node.initializer.arguments[0]:node.initializer;
   if(pins||!array||!ts.isArrayLiteralExpression(array)||array.elements.filter(e=>ts.isSpreadElement(e)&&e.expression.getText(ast)==='generatedReleases').length!==1)throw Error('Historical release registry preimage differs');
   pins=array.elements.filter(e=>!ts.isSpreadElement(e)).map(e=>browserToolPinSchema.parse(JSON.parse(e.getText(ast))));
  }ts.forEachChild(node,visit);
 }visit(ast);if(!pins)throw Error('Historical release registry preimage differs');return pins;
}

/** One local adoption transaction for every tool, draft or already published.
 * Publication, source execution, network and editorial rewriting are excluded. */
async function installUnlocked(input:{siteRoot:string;sourceRoot:string;artifactRoot:string;review:unknown;releaseId:string;placement?:unknown;display?:unknown;publicAdmission?:unknown;apply?:boolean;replaceArtifact?:string}){
 const root=resolve(input.siteRoot);await noToolLinks(root);await checkBrowserToolInstallations(root);
 const configText=await readFile(join(root,configPath),'utf8'),before=configuration.parse(JSON.parse(configText)),candidate=await verifyToolCandidate(input),review=browserToolReviewSchema.parse(input.review);
 const pin=browserToolPinSchema.parse({...candidate.pinFields,releaseId:input.releaseId});
 if(pin.source.kind!=='github')throw Error('Public installer requires reviewed GitHub source');
 const prior=before.installations.find(x=>x.pin.toolId===pin.toolId);
 const pageFiles=new Map<string,string>();let registration;
 if(prior){
  if(input.replaceArtifact!==prior.pin.artifactSha256)throw Error('Update requires exact --replace-artifact of the selected release');
  if(JSON.stringify(pin.source)!==JSON.stringify(prior.pin.source))throw Error('Source repository change requires explicit migration');
  if(input.display!==undefined)throw Error('Managed update preserves presentation; review its registration separately');
  if(input.placement!==undefined)throw Error('Managed update preserves placement and editorial page; omit --placement');
  if(pin.releaseId===prior.pin.releaseId)throw Error('Update requires a fresh immutable releaseId');
  registration=prior.placement;
 }else{
  if(input.replaceArtifact)throw Error('No managed prior installation to replace');
  const p=browserToolPlacementSchema.parse(input.placement);registration=browserToolRegistrationSchema.parse({contentId:p.contentId,slug:p.slug,hydration:p.hydration,...(input.display!==undefined?{display:toolDisplayPolicySchema.parse(input.display)}:{})});
  const page='apps/site/src/content/tools/'+p.slug+'.mdx';
  if(await optional(join(root,page))!==null||await optional(join(root,page.replace(/\.mdx$/u,'.md')))!==null)throw Error('Placement already exists; explicit migration required');
  const {contentId:id,slug:_slug,hydration:_hydration,...front}=p;
  pageFiles.set(page,'---\n'+Object.entries({id,...front}).map(([k,v])=>JSON.stringify(k)+': '+JSON.stringify(v)).join('\n')+'\n---\n\n<Demo module='+JSON.stringify(pin.toolId)+' />\n');
 }
 const next=configuration.parse({schemaVersion:1,installations:[...before.installations.filter(x=>x!==prior),{pin,placement:registration}].sort((a,b)=>a.pin.toolId.localeCompare(b.pin.toolId,'en'))});
 const candidateManifest=JSON.parse(candidate.files.get('browser-tool.json')!.toString('utf8'));
 await assertToolDisplayPolicy(root,pin.toolId,candidateManifest.license.spdx,registration.display);
 const admissions=await readPublicAdmissions(root),admitted=new Map(admissions.releases.map(p=>[p.toolId,p]));
 if(input.publicAdmission!==undefined){assertToolPublicAdmission(pin,review,input.publicAdmission,{bounded:JSON.parse(candidate.files.get('browser-tool.json')!.toString('utf8')).runtime.profile==='bounded-browser-v2'});admitted.set(pin.toolId,pin);}
 const durable=reviewPath(pin),reviewText=json(review),existingReview=await optional(join(root,durable));
 if(existingReview!==null&&existingReview!==reviewText)throw Error('Immutable review path already exists with different bytes');
 pageFiles.set(durable,reviewText);
 await checkIdentity(root,next,{pages:pageFiles,admissions:admitted});
 const pkgPath='apps/site/package.json',pkgText=await readFile(join(root,pkgPath),'utf8'),pkg=JSON.parse(pkgText);
 if(pkg.dependencies?.[pin.packageName]&&(!prior||pkg.dependencies[pin.packageName]!=='file:../../vendor/browser-tools/'+prior.pin.toolId+'/'+prior.pin.releaseId))throw Error('Dependency already exists; explicit migration required');
 const releasePath='apps/site/src/content-registry/interactive/releases.ts',releases=await optional(join(root,releasePath));
 if(prior){
  const needle='...generatedReleases,';
  if(!releases||releases.split(needle).length!==2)throw Error('Historical release registry preimage differs');
  const history=releaseHistory(releases);
  if(history.some(p=>p.toolId===pin.toolId&&(p.releaseId===prior.pin.releaseId||p.releaseId===pin.releaseId)))throw Error('Historical release identity collision');
  // Release identifiers may repeat across different tools; immutable artifact ownership may not.
  if(releases.includes('"artifactSha256": "'+pin.artifactSha256+'"'))throw Error('Fresh immutable release required; history collision');
  pageFiles.set(releasePath,releases.replace(needle,()=>needle+'\n'+JSON.stringify(prior.pin,null,2)+','));
 }
 const manifest=JSON.parse(candidate.files.get('browser-tool.json')!.toString('utf8'));
 for(const notice of registration.display?.additionalNotices??[]){
  if(!manifest.license.additional?.includes(notice.file)||!candidate.files.has(notice.file))throw Error('Display notice must belong to reviewed release');
  const path='apps/site/public/tool-licenses/'+pin.toolId+'-v'+manifest.version+'/'+notice.file.split('/').at(-1),text=toolLicenseText(candidate.files.get(notice.file)!),old=await optional(join(root,path));
  if(old!==null&&old!==text)throw Error('Immutable public license differs');pageFiles.set(path,text);
 }
 const page='apps/site/src/content/tools/'+registration.slug+'.mdx',pageText=pageFiles.get(page)??await readFile(join(root,page),'utf8');
 const draft=parseYaml(pageText.split(/^---\s*$/mu)[1]!).draft;
 const metadataFiles=[configPath,pkgPath,'package-lock.json',durable,...(prior?[releasePath]:[]),...(input.publicAdmission!==undefined?[publicAdmissionPath]:[])];
 const previous=new Map<string,string|null>();
 for(const path of new Set([...render(next).keys(),...metadataFiles,...pageFiles.keys(),page]))previous.set(path,await optional(join(root,path)));
 if(previous.get(configPath)!==configText||previous.get(pkgPath)!==pkgText||(prior&&previous.get(releasePath)!==releases)||previous.get(durable)!==existingReview||previous.get(page)!==(pageFiles.has(page)?null:pageText))throw Error('Installation derivation preimage changed');
 // Refuse unmanaged generated ownership collisions, including outside generated/.
 const priorGenerated=await generatedFiles(root,before);
 for(const path of priorGenerated.keys())if(!previous.has(path))previous.set(path,await optional(join(root,path)));
 for(const [path,text]of priorGenerated)if(previous.has(path)&&previous.get(path)!==text)throw Error('Generated preimage changed: '+path);
 for(const path of render(next).keys())if(!priorGenerated.has(path)&&previous.get(path)!==null)throw Error('Unmanaged generated file collision: '+path);
 const plan={toolId:pin.toolId,fromReleaseId:prior?.pin.releaseId,releaseId:pin.releaseId,artifactSha256:pin.artifactSha256,route:'/tools/'+registration.slug+'/',contentId:registration.contentId,
  draft,contentChanged:!prior,network:false,publication:false,generatedFiles:[...render(next).keys()],metadataFiles,
  nextBuildStep:'npm ci --ignore-scripts, then normal validation/build and actual dist acceptance',capabilityGate:'Exact public admission required for published entries; deployment needs separate authorization.'};
 if(!input.apply)return plan;
 const adopted=await adoptToolRelease({...input,review,vendorRoot:join(root,'vendor/browser-tools')});
 if(json(adopted)!==json(pin))throw Error('Adopted identity differs; unselected immutable artifact retained');
 const files=await generatedFiles(root,next);for(const [path,text]of pageFiles)files.set(path,text);
 for(const path of files.keys())if(!previous.has(path))throw Error('Unplanned generated write path: '+path);
 files.set(configPath,json(next));
 if(input.publicAdmission!==undefined)files.set(publicAdmissionPath,json({schemaVersion:1,releases:[...admitted.values()].sort((a,b)=>a.toolId.localeCompare(b.toolId,'en'))}));
 pkg.dependencies[pin.packageName]='file:../../vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId;files.set(pkgPath,json(pkg));
 const assertPreimages=async()=>{for(const [path,text]of previous)if(await optional(join(root,path))!==text)throw Error('Installation preimage changed; preserve user edits and re-plan: '+path);};
 await assertPreimages();
 // Resolve npm's lock only in isolation. No registry call or package script, and
 // no temporary lock mutation in the user's checkout.
 const stage=await mkdtemp(join(await installerDirectory(root),'tool-lock-'));
 try{
  const oldLock=JSON.parse(previous.get('package-lock.json')!),manifests=new Set(['package.json',...Object.keys(oldLock.packages).filter(p=>p&&!p.includes('node_modules')).map(p=>p+'/package.json'),'vendor/browser-tools/'+pin.toolId+'/'+pin.releaseId+'/package.json']);
  for(const path of manifests){const text=files.get(path)??await readFile(join(root,path),'utf8');await mkdir(dirname(join(stage,path)),{recursive:true});await writeFile(join(stage,path),text);}
  await writeFile(join(stage,'package-lock.json'),previous.get('package-lock.json')!);
  const npm=process.env.npm_execpath;if(!npm)throw Error('Run the installer through the pinned npm entrypoint');
  execFileSync(process.execPath,[npm,'install','--package-lock-only','--ignore-scripts','--offline','--no-audit','--no-fund'],{cwd:stage,stdio:'pipe',timeout:60000});
  files.set('package-lock.json',await readFile(join(stage,'package-lock.json'),'utf8'));
 }finally{await rm(stage,{recursive:true,force:true});}
 await assertPreimages();
 try{
  for(const [path,text]of files){
   if(text===previous.get(path))continue;
   const target=join(root,path);await mkdir(dirname(target),{recursive:true});await noToolLinks(dirname(target));
   const temporary=join(dirname(target),'.browser-tool-transfer-'+randomUUID());
   try{await writeFile(temporary,text,{flag:'wx'});const h=await open(temporary,'r+');try{await h.sync();}finally{await h.close();}
    if(await optional(target)!==previous.get(path))throw Error('Installation preimage changed: '+path);await rename(temporary,target);
   }finally{await rm(temporary,{force:true});}
  }
  await checkBrowserToolInstallations(root);
 }catch(error){
  for(const [path,text]of previous){const current=await optional(join(root,path));if(current!==text&&current!==files.get(path))throw Error('Installation interrupted; preserve edits and inspect: '+path,{cause:error});}
  for(const [path,text]of previous){const target=join(root,path),current=await optional(target);if(current===text)continue;
   if(current!==files.get(path))throw Error('Rollback interrupted; preserve edits and inspect: '+path,{cause:error});
   if(text===null)await rm(target,{force:true});else{const temporary=join(dirname(target),'.browser-tool-transfer-'+randomUUID());
    try{await writeFile(temporary,text,{flag:'wx'});if(await optional(target)!==current)throw Error('Rollback preimage changed: '+path);await rename(temporary,target);}finally{await rm(temporary,{force:true});}}
  }throw error;
 }
 return {...plan,applied:true,lockSha256:toolHash(await readFile(join(root,'package-lock.json')))};
}
async function installerDirectory(root:string){
 await noToolLinks(root);const dir=join(root,'.local');try{await noToolLinks(dir);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(dir,{recursive:true});await noToolLinks(dir);return dir;
}
export async function installBrowserTool(input:Parameters<typeof installUnlocked>[0]){
 if(!input.apply)return installUnlocked(input);
 const dir=await installerDirectory(resolve(input.siteRoot)),path=join(dir,'browser-tool-install.lock'),lock=await open(path,'wx');
 try{return await installUnlocked(input);}finally{await lock.close();await rm(path);}
}
export async function initializeBrowserToolInstallations(root:string){
 const c=await load(root);for(const [path,text]of await generatedFiles(root,c)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),text);}
}
