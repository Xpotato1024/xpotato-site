import {it,expect,vi} from 'vitest';
import {spawnSync} from 'node:child_process';
import {resolve,basename} from 'node:path';
import {sha256} from '../../packages/article-pipeline/src/canonical.js';
import {validateCiPublicationContext,type PublicationProgress} from '../../packages/article-pipeline/src/publication/ci-publication.js';
const cli=resolve('tools/publication/media-publication.ts');
it.each(['prepare-owner-subject','prepare-owner-reviewed'])('%s cannot operate inside CI or create operator authority from a file',command=>{
 const result=spawnSync(process.execPath,['--import','tsx',cli,command,'--job','job-fixture','--file','approved-owner.json','--visual-input','fixture.json','--output','.local/not-created.json'],
  {cwd:resolve('.'),encoding:'utf8',env:{...process.env,CI:'true'}});
 expect(result.status).toBe(1);expect(result.stderr).toContain('"articleDeployed":false');
 expect(result.stdout).not.toContain('prepared');
},30000);

const sourceSha='a'.repeat(40),contentId='11111111-1111-4111-8111-111111111111';
const selectedBytes=Buffer.from(JSON.stringify({contentId,semanticSha256:'b'.repeat(64),revision:{kind:'media_only'}})+'\n');
const selectedHash=sha256(selectedBytes);
type HarnessOptions={head?:string;bytes?:Buffer;missingAdmission?:boolean;invalidPackage?:boolean;invalidMedia?:boolean;
 releaseChange?:(release:Record<string,unknown>)=>void;registrationError?:string};
async function runCli(command:string,values:Record<string,string|undefined>={},options:HarnessOptions={}){
 vi.resetModules();
 const events:string[]=[],writes:Array<{path:string;data:unknown}>=[],bytes=options.bytes??selectedBytes;
 const p=JSON.parse(bytes.toString('utf8')),admission={from:'trusted-main'},repo={commit:sourceSha};
 const release:Record<string,unknown>={draft:true,author:{login:'Xpotato1024'},assets:[{id:2,state:'uploaded',uploader:{login:'Xpotato1024'},content_type:'application/json',size:bytes.length}]};
 options.releaseChange?.(release);
 const exec=vi.fn((file:string,args:string[])=>{
  events.push(file+' '+args.join(' '));
  if(file==='git'&&args[0]==='rev-parse')return options.head??sourceSha;
  if(file==='git'&&args[0]==='show'){if(options.missingAdmission)throw Error('no admission');return JSON.stringify(admission);}
  if(file==='gh'&&args[1]?.endsWith('/releases/1'))return JSON.stringify(release);
  if(file==='gh'&&args[1]?.endsWith('/releases/assets/2'))return bytes;
  throw Error('unexpected command');
 });
 const validatePackage=vi.fn((value:unknown)=>{events.push('validate-package');if(options.invalidPackage)throw Error('bad package');return value;});
 const validateMedia=vi.fn(async()=>{events.push('validate-media');if(options.invalidMedia)throw Error('bad image');});
 const assertAdmission=vi.fn(()=>{events.push('assert-admission');return admission;});
 const revision=vi.fn(),loadRepository=vi.fn(async()=>repo),read=vi.fn(async()=>'base');
 const safeRead=vi.fn(async()=>{events.push('read-package');return bytes;});
 const close=vi.fn(),storage={close},createStorage=vi.fn(()=>{events.push('create-storage');return storage;});
 const progress:PublicationProgress={plane:'public',key:'media/v1/fixture.png',sha256:'d'.repeat(64),phase:'verified'};
 const registration={protocol:'xpotato-ci-media-registration-result-v1',contentId,packageSha256:selectedHash,semanticSha256:p.semanticSha256,
  objects:[],assets:[{assetId:'hero',url:'https://media.example.invalid/fixture.png'}],storageVerified:true,articleDeployed:false,exportAuthorized:false,canonicalFilesApplied:false};
 const register=vi.fn(async(_bytes:Uint8Array,input:{progress?:(event:PublicationProgress)=>Promise<void>})=>{
  events.push('register-media');await input.progress?.(progress);if(options.registrationError)throw Error(options.registrationError);return registration;
 });
 const publish=vi.fn(async()=>({changes:[{path:'apps/site/src/content/blog/fixture.mdx',before:'base',after:'exported'}],patch:'patch',
  rollback:{patch:'rollback'},sources:[],protection:{objects:[]}}));
 vi.doMock('node:child_process',()=>({execFileSync:exec}));
 vi.doMock('node:fs/promises',()=>({readFile:read,mkdir:vi.fn(async()=>{}),writeFile:vi.fn(async(path:string,data:unknown)=>{events.push('write '+basename(path));writes.push({path,data});})}));
 vi.doMock('../authoring/article-repository.js',()=>({repository:resolve('.'),loadRepository}));
 vi.doMock('../../packages/article-pipeline/src/publication/ci-publication-package.js',()=>({
  prepareCiPublicationBundle:vi.fn(),validateCiPublicationPackage:validatePackage,validateCiPublicationMedia:validateMedia,assertCiPublicationAdmission:assertAdmission}));
 vi.doMock('../../packages/article-pipeline/src/publication/ci-publication.js',()=>({publishCiPackage:publish,validateCiPublicationContext}));
 vi.doMock('../../packages/article-pipeline/src/publication/ci-media-registration.js',()=>({registerCiMediaPackage:register}));
 vi.doMock('../../packages/article-pipeline/src/publication/owner-reviewed-publication.js',()=>({prepareOwnerPublicationSubject:vi.fn(),prepareStoredOwnerReviewedPublicationBundle:vi.fn()}));
 vi.doMock('../../packages/article-pipeline/src/media/r2-sdk-store.js',()=>({createR2SdkStorage:createStorage}));
 vi.doMock('../../packages/article-pipeline/src/draft-job.js',()=>({jobDirectory:vi.fn()}));
 vi.doMock('../../packages/article-pipeline/src/private-files.js',()=>({safeReadBytes:safeRead,privateRoot:vi.fn()}));
 vi.doMock('../../packages/article-pipeline/src/publication/publication-export.js',()=>({publicationFileSlug:vi.fn(()=>'fixture')}));
 vi.doMock('../../packages/article-pipeline/src/publication/publication-revision.js',()=>({assertPublicationRevisionGit:revision}));
 const env={GITHUB_ACTIONS:'true',MEDIA_PUBLICATION_ENABLED:'true',GITHUB_REPOSITORY:'Xpotato1024/xpotato-site',GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:'Xpotato1024',GITHUB_TRIGGERING_ACTOR:'Xpotato1024',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:sourceSha,MEDIA_PUBLICATION_ENVIRONMENT:'site-production',R2_MEDIA_CONFIG_JSON:'{}'};
 for(const [key,value]of Object.entries(env))vi.stubEnv(key,value);
 const argv=process.argv,exitCode=process.exitCode,log=vi.spyOn(console,'log').mockImplementation(()=>{}),error=vi.spyOn(console,'error').mockImplementation(()=>{});
 const selected={file:'selected-package.json',output:'synthetic-result',sha256:selectedHash,'release-id':'1','asset-id':'2',...values};
 process.argv=[process.execPath,cli,command,...Object.entries(selected).flatMap(([key,value])=>value===undefined?[]:['--'+key,value])];
 process.exitCode=undefined;
 try{
  await import('./media-publication.js');
  return {events,writes,p,admission,exec,validatePackage,validateMedia,assertAdmission,revision,loadRepository,read,safeRead,createStorage,storage,
   register,publish,close,progress,registration,exitCode:process.exitCode,stdout:log.mock.calls.flat().join('\n'),stderr:error.mock.calls.flat().join('\n')};
 }finally{
  process.argv=argv;process.exitCode=exitCode;vi.unstubAllEnvs();log.mockRestore();error.mockRestore();
 }
}

it.each(['register-media','verify-media-only'])('acquires %s before article admission without bypassing package and image validation',async mode=>{
 const x=await runCli('acquire',{mode},{missingAdmission:true});
 expect(x.exitCode).toBeUndefined();expect(x.validatePackage).toHaveBeenCalledWith(x.p);expect(x.validateMedia).toHaveBeenCalledWith(x.p);
 expect(x.exec.mock.calls.some(([file,args])=>file==='git'&&args[0]==='show')).toBe(false);
 expect(x.assertAdmission).not.toHaveBeenCalled();expect(x.revision).not.toHaveBeenCalled();expect(x.createStorage).not.toHaveBeenCalled();
 expect(x.events.indexOf('git rev-parse HEAD')).toBeLessThan(x.events.findIndex(s=>s.startsWith('gh ')));
 expect(x.events.indexOf('validate-media')).toBeLessThan(x.events.indexOf('write synthetic-result'));
 expect(x.writes).toEqual([{path:'synthetic-result',data:selectedBytes}]);
});
it.each(['publish','verify-only'])('acquisition in %s still requires the trusted main admission and revision',async mode=>{
 const x=await runCli('acquire',{mode});
 expect(x.exitCode).toBeUndefined();expect(x.exec).toHaveBeenCalledWith('git',['show',sourceSha+':config/article-publication-admissions/'+contentId+'.json'],expect.any(Object));
 expect(x.assertAdmission).toHaveBeenCalledWith(x.p,selectedHash,x.admission);
 expect(x.revision).toHaveBeenCalledWith(resolve('.'),sourceSha,contentId,x.p.revision);
 expect(x.validateMedia).toHaveBeenCalledWith(x.p);
 const missing=await runCli('acquire',{mode},{missingAdmission:true});
 expect(missing.exitCode).toBe(1);expect(missing.writes).toEqual([]);expect(missing.createStorage).not.toHaveBeenCalled();
});
it.each([undefined,'register','media-only','verify-media','$(touch injected)'])('rejects acquire mode %s before package access',async mode=>{
 const x=await runCli('acquire',{mode});expect(x.exitCode).toBe(1);expect(x.exec).not.toHaveBeenCalled();expect(x.writes).toEqual([]);
});
it.each(['acquire','register-media'])('%s checks actual HEAD even without main article admission',async command=>{
 const x=await runCli(command,{mode:'register-media'},{head:'c'.repeat(40)});
 expect(x.exitCode).toBe(1);expect(x.stderr).toContain('CI_PUBLICATION_CONTEXT_CHANGED');
 expect(x.exec.mock.calls.filter(([file])=>file==='gh')).toEqual([]);expect(x.createStorage).not.toHaveBeenCalled();expect(x.writes).toEqual([]);
});
it.each([undefined,'invalid','A'.repeat(64)])('rejects an invalid selected hash %s before acquisition',async hash=>{
 const x=await runCli('acquire',{mode:'register-media',sha256:hash});
 expect(x.exitCode).toBe(1);expect(x.exec).not.toHaveBeenCalled();expect(x.writes).toEqual([]);
});
it.each(['acquire','register-media'])('%s rejects changed package bytes even with the same semantic package',async command=>{
 const x=await runCli(command,{mode:'register-media'},{bytes:Buffer.concat([selectedBytes,Buffer.from(' ')])});
 expect(x.exitCode).toBe(1);expect(x.createStorage).not.toHaveBeenCalled();expect(x.register).not.toHaveBeenCalled();expect(x.writes).toEqual([]);
});
it.each([
 ['release owner',(r:Record<string,unknown>)=>{r.author={login:'other'};}],
 ['published release',(r:Record<string,unknown>)=>{r.draft=false;}],
 ['missing asset',(r:Record<string,unknown>)=>{r.assets=[];}],
 ['asset owner',(r:Record<string,unknown>)=>{(r.assets as Array<Record<string,unknown>>)[0]!.uploader={login:'other'};}],
 ['asset type',(r:Record<string,unknown>)=>{(r.assets as Array<Record<string,unknown>>)[0]!.content_type='text/javascript';}],
 ['asset state',(r:Record<string,unknown>)=>{(r.assets as Array<Record<string,unknown>>)[0]!.state='open';}],
 ['asset size',(r:Record<string,unknown>)=>{(r.assets as Array<Record<string,unknown>>)[0]!.size=96*1024*1024+1;}],
] as const)('retains %s admission for media-only acquisition',async(_name,releaseChange)=>{
 const x=await runCli('acquire',{mode:'register-media'},{releaseChange});
 expect(x.exitCode).toBe(1);expect(x.exec.mock.calls.filter(([file,args])=>file==='gh'&&args[1]?.includes('/releases/assets/'))).toEqual([]);
 expect(x.writes).toEqual([]);expect(x.createStorage).not.toHaveBeenCalled();
});
it.each([{invalidPackage:true},{invalidMedia:true}])('does not persist an invalid media package: %j',async options=>{
 const x=await runCli('acquire',{mode:'register-media'},options);
 expect(x.exitCode).toBe(1);expect(x.writes).toEqual([]);expect(x.createStorage).not.toHaveBeenCalled();
});
it.each(['register-media','verify-media-only'])('the %s CLI re-reads exact bytes and emits media results without any article files',async mode=>{
 const x=await runCli('register-media',{mode},{missingAdmission:true});
 expect(x.exitCode).toBeUndefined();expect(x.safeRead).toHaveBeenCalledWith(resolve('selected-package.json'),96*1024*1024);
 expect(x.events.indexOf('read-package')).toBeLessThan(x.events.indexOf('create-storage'));
 expect(x.register).toHaveBeenCalledWith(selectedBytes,expect.objectContaining({storage:x.storage,packageSha256:selectedHash,mode,context:expect.objectContaining({sourceSha})}));
 expect(x.assertAdmission).not.toHaveBeenCalled();expect(x.revision).not.toHaveBeenCalled();expect(x.loadRepository).not.toHaveBeenCalled();
 expect(x.read).not.toHaveBeenCalled();expect(x.publish).not.toHaveBeenCalled();expect(x.close).toHaveBeenCalledOnce();
 expect(x.writes.map(w=>basename(w.path))).toEqual(['progress.json','media-registration-result.json']);
 expect(JSON.parse(x.writes[1]!.data as string)).toEqual(x.registration);
 expect(x.stdout).toContain('"exportAuthorized":false');expect(x.stdout).toContain('"articleDeployed":false');
});
it.each([['register-media','publish'],['register-media','verify-only'],['publish','register-media'],['publish','verify-media-only']] as const)(
 'does not use command %s to execute mode %s',async(command,mode)=>{
 const x=await runCli(command,{mode});expect(x.exitCode).toBe(1);expect(x.exec).not.toHaveBeenCalled();
 expect(x.createStorage).not.toHaveBeenCalled();expect(x.register).not.toHaveBeenCalled();expect(x.publish).not.toHaveBeenCalled();
});
it('stops media registration with a redacted failure and a read-only recovery mode, never an export',async()=>{
 const x=await runCli('register-media',{mode:'register-media'},{registrationError:'provider Authorization: private-token'});
 expect(x.exitCode).toBe(1);expect(x.writes.map(w=>basename(w.path))).toEqual(['progress.json','failure.json']);
 const failure=JSON.parse(x.writes[1]!.data as string);expect(failure).toMatchObject({articleDeployed:false,exportAuthorized:false,lastProgress:x.progress});
 expect(failure.recovery).toContain('verify-media-only');expect(JSON.stringify(x.writes)).not.toContain('private-token');
 expect(x.stderr).not.toContain('Authorization');expect(x.close).toHaveBeenCalledOnce();expect(x.publish).not.toHaveBeenCalled();
});
it.each(['publish','verify-only'])('keeps the article %s admission, preimage snapshot, and export paths',async mode=>{
 const x=await runCli('publish',{mode});
 expect(x.exitCode).toBeUndefined();expect(x.assertAdmission).toHaveBeenCalledWith(x.p,selectedHash,x.admission);
 expect(x.revision).toHaveBeenCalled();expect(x.loadRepository).toHaveBeenCalledOnce();expect(x.read).toHaveBeenCalledTimes(7);
 expect(x.publish).toHaveBeenCalledWith(x.p,expect.objectContaining({admission:x.admission,packageSha256:selectedHash,mode,base:expect.any(Object)}));
 expect(x.register).not.toHaveBeenCalled();expect(x.writes.map(w=>basename(w.path))).toEqual(['fixture.mdx','changes.patch','publication-result.json','rollback.patch']);
 expect(x.close).toHaveBeenCalledOnce();
});

it.each(['publish','verify-only'])('a successful registration does not authorize later article %s without main admission',async mode=>{
 const registered=await runCli('register-media',{mode:'register-media'},{missingAdmission:true});
 expect(registered.exitCode).toBeUndefined();expect(registered.writes.map(w=>basename(w.path))).toContain('media-registration-result.json');
 const article=await runCli('publish',{mode},{missingAdmission:true});
 expect(article.exitCode).toBe(1);expect(article.writes).toEqual([]);expect(article.createStorage).not.toHaveBeenCalled();expect(article.publish).not.toHaveBeenCalled();
});
