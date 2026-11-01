import {parseArgs} from 'node:util';import {join,resolve,dirname} from 'node:path';import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {repository,loadRepository} from './article-repository.js';
import {prepareCiPublicationBundle,validateCiPublicationPackage,validateCiPublicationMedia,assertCiPublicationAdmission} from '../packages/article-pipeline/src/ci-publication-package.js';
import {publishCiPackage,validateCiPublicationContext,type PublicationProgress} from '../packages/article-pipeline/src/ci-publication.js';
import {createR2SdkStorage} from '../packages/article-pipeline/src/r2-sdk-store.js';
import {canonicalJson,sha256} from '../packages/article-pipeline/src/canonical.js';
import {jobDirectory} from '../packages/article-pipeline/src/draft-job.js';
import {safeReadBytes,privateRoot} from '../packages/article-pipeline/src/private-files.js';
import {publicationFileSlug} from '../packages/article-pipeline/src/publication-export.js';
const args=parseArgs({options:{job:{type:'string'},file:{type:'string'},output:{type:'string'},sha256:{type:'string'},mode:{type:'string'},'release-id':{type:'string'},'asset-id':{type:'string'}},allowPositionals:true,strict:true});
const [command]=args.positionals,v=args.values;
let outputDirectory:string|undefined;
let lastProgress:PublicationProgress|undefined;
function context(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.MEDIA_PUBLICATION_ENABLED!=='true')throw Error('CI_PUBLICATION_NOT_CONFIGURED');
 return validateCiPublicationContext({repository:process.env.GITHUB_REPOSITORY,event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF,
  actor:process.env.GITHUB_ACTOR,triggeringActor:process.env.GITHUB_TRIGGERING_ACTOR,runId:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT),
  sourceSha:process.env.GITHUB_SHA,environment:process.env.MEDIA_PUBLICATION_ENVIRONMENT});
}
async function packageFile(){
 if(!v.file||!v.sha256||!/^[a-f0-9]{64}$/u.test(v.sha256))throw Error('PUBLICATION_PACKAGE_SELECTION_REQUIRED');
 const bytes=await safeReadBytes(resolve(v.file),96*1024*1024);if(sha256(bytes)!==v.sha256)throw Error('PUBLICATION_PACKAGE_HASH_MISMATCH');
 return validateCiPublicationPackage(JSON.parse(bytes.toString('utf8')));
}
async function admission(p:ReturnType<typeof validateCiPublicationPackage>,hash:string){
 const run=context(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
 if(head!==run.sourceSha)throw Error('CI_PUBLICATION_CONTEXT_CHANGED');
 // Select only the reviewed Git blob from this exact trusted main commit.
 const path='config/article-publication-admissions/'+p.contentId+'.json';
 const record=JSON.parse(execFileSync('git',['show',head+':'+path],{cwd:repository,encoding:'utf8',maxBuffer:256*1024,stdio:['ignore','pipe','pipe']}));
 return assertCiPublicationAdmission(p,hash,record);
}
try{
 if(command==='prepare'){
  if(!v.job||!v.output||process.env.CI)throw Error('LOCAL_PUBLICATION_PACKAGE_REQUIRED');
  const bundle=await prepareCiPublicationBundle(jobDirectory(await privateRoot(repository),v.job),await loadRepository(),repository),{package:p,bytes}=bundle;
  const file=resolve(v.output);
  const relative=(await import('node:path')).relative(join(repository,'.local'),file);if(relative.startsWith('..')||(await import('node:path')).isAbsolute(relative))throw Error('LOCAL_PUBLICATION_OUTPUT_REQUIRED');
  await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});
  await writeFile(file+'.admission.json',canonicalJson(bundle.admission)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:'prepared_not_approved',file,sha256:sha256(bytes),semanticSha256:p.semanticSha256,objects:p.objects.length,storageWrites:0}));
 }else if(command==='acquire'){
  context();if(!v.output||![v['release-id'],v['asset-id']].every(id=>id&&/^[1-9][0-9]{0,19}$/u.test(id)))throw Error('PUBLICATION_ASSET_SELECTION_REQUIRED');
  // Runs before any R2 secret is injected. gh uses the existing job token.
  const repo='repos/Xpotato1024/xpotato-site',release=JSON.parse(execFileSync('gh',['api',repo+'/releases/'+v['release-id']],{encoding:'utf8',maxBuffer:2*1024*1024,windowsHide:true}));
  const asset=release.assets?.find((a:{id:number})=>String(a.id)===v['asset-id']);
  if(release.draft!==true||release.author?.login!=='Xpotato1024'||!asset||asset.state!=='uploaded'||asset.uploader?.login!=='Xpotato1024'
   ||asset.content_type!=='application/json'||asset.size<=0||asset.size>96*1024*1024)throw Error('PUBLICATION_ASSET_NOT_ADMITTED');
  const bytes=execFileSync('gh',['api',repo+'/releases/assets/'+v['asset-id'],'-H','Accept: application/octet-stream'],{maxBuffer:96*1024*1024,windowsHide:true});
  if(bytes.length!==asset.size||sha256(bytes)!==v.sha256)throw Error('PUBLICATION_PACKAGE_HASH_MISMATCH');
  const p=validateCiPublicationPackage(JSON.parse(bytes.toString('utf8')));await admission(p,v.sha256!);await validateCiPublicationMedia(p);
  await mkdir(dirname(resolve(v.output)),{recursive:true});await writeFile(v.output,bytes,{flag:'wx'});
  console.log(JSON.stringify({status:'package_verified',sha256:v.sha256,storageWrites:0}));
 }else if(command==='validate'){
  const p=await packageFile();console.log(JSON.stringify({status:'valid_not_approved',semanticSha256:p.semanticSha256,storageWrites:0}));
 }else if(command==='publish'){
  const run=context(),p=await packageFile(),accepted=await admission(p,v.sha256!),repo=await loadRepository();if(!v.output||!['publish','verify-only'].includes(v.mode??''))throw Error('PUBLICATION_MODE_REQUIRED');
  const id=p.contentId,slug=publicationFileSlug(repo,id),paths=['apps/site/src/content/blog/'+slug+'.mdx',
   ...['media','media-rights','provenance'].flatMap(n=>['apps/site/src/content-registry/'+n+'/index.ts','apps/site/src/content-registry/'+n+'/blog/'+id+'.json'])];
  const base:Record<string,string|null>={};for(const path of paths){try{base[path]=await readFile(join(repository,path),'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;base[path]=null;}}
  const storage=createR2SdkStorage(JSON.parse(process.env.R2_MEDIA_CONFIG_JSON??'null'),{accessKeyId:process.env.R2_MEDIA_ACCESS_KEY_ID??'',secretAccessKey:process.env.R2_MEDIA_SECRET_ACCESS_KEY??''});
  outputDirectory=resolve(v.output);await mkdir(outputDirectory,{recursive:true});
  try{const r=await publishCiPackage(p,{storage,context:run,repo,base,admission:accepted,packageSha256:v.sha256!,mode:v.mode as 'publish'|'verify-only',progress:async event=>{
    lastProgress=event;await writeFile(join(outputDirectory!,'progress.json'),canonicalJson({status:'incomplete',lastProgress:event,articleDeployed:false})+'\n');
   }}),out=outputDirectory;
   for(const change of r.changes){if(change.after===null)throw Error('CI_PUBLICATION_DELETE_DENIED');const path=join(out,'files',change.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,change.after,{flag:'wx'});}
   await writeFile(join(out,'changes.patch'),r.patch,{flag:'wx'});await writeFile(join(out,'publication-result.json'),canonicalJson(r)+'\n',{flag:'wx'});
   console.log(JSON.stringify({status:'storage_verified_export_prepared',semanticSha256:p.semanticSha256,sourceObjects:r.sources.length,publicObjects:r.protection.objects.length,articleDeployed:false}));
  }finally{storage.close();}
 }else throw Error('PUBLICATION_COMMAND_INVALID');
}catch(error){
 // SDK/provider errors may contain request headers or signed URLs. Never emit
 // their text, stack, input bundle, environment or credential values.
 const known=new Set(['R2_PUT_UNKNOWN_NO_RETRY','R2_READ_UNKNOWN','R2_PUBLIC_READ_UNKNOWN','R2_BYTES_OR_METADATA_MISMATCH','CI_PUBLICATION_BASE_CONFLICT','CI_PUBLICATION_CONTEXT_CHANGED']);
 const code=error instanceof Error&&known.has(error.message)?error.message:'CI_PUBLICATION_FAILED_NO_AUTOMATIC_RETRY';
 const result={status:'stopped',code,lastProgress,articleDeployed:false,exportAuthorized:false,recovery:'New manual verify-only run; no automatic PUT retry'};
 if(outputDirectory)await writeFile(join(outputDirectory,'failure.json'),canonicalJson(result)+'\n');
 console.error(JSON.stringify(result));process.exitCode=1;
}
