import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {articleRoute} from '@xpotato/content-contracts';
import {fingerprint,sha256} from './canonical.js';
import {stageExistingArticleInput} from './existing-article-intake.js';
import {initExistingArticleJob,initDraft,readDraftStore,attemptStatus,reviseDraft,guideDraft,type DraftRepository} from './draft-job.js';
import {buildDraftPreview} from './draft-preview.js';
import {contentReviewContext} from './content-review.js';
import {articleCli} from './cli.js';

const id='11111111-1111-4111-8111-111111111111',roots:string[]=[];
const repo:DraftRepository={commit:'a'.repeat(40),fingerprint:'b'.repeat(64),categories:[{id:'software',label:'ソフトウェア',status:'active'}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:'empty'}};
const original="---\nid: "+id+"\ntitle: 既成AI稿\ndescription: 保存済み原稿の説明\npubDate: '2026-10-28'\ncategory: software\ntags: []\ndraft: false\n---\n## 本文\n\n原文を再生成しません。\n";
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function input(){
 const root=await mkdtemp(join(tmpdir(),'existing-job-'));roots.push(root);
 const source=join(root,'.local/existing-article-sources');await mkdir(source,{recursive:true});
 const files=[{id:'manuscript',role:'manuscript',path:'article.mdx',origin:'ai_generated',lineageIds:['history'],bytes:original},
  {id:'hero',role:'hero',path:'hero.txt',origin:'ai_generated',lineageIds:['history'],bytes:'received hero bytes'},
  {id:'history',role:'lineage',path:'history.json',origin:'user_supplied',lineageIds:[],bytes:'{"observed":"historical, unreviewed"}'}];
 for(const file of files)await writeFile(join(source,file.path),file.bytes);
 const staged=await stageExistingArticleInput(root,source,{schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,
  baseCommit:repo.commit,artifacts:files.map(({bytes,...file})=>({...file,sha256:sha256(bytes),sizeBytes:Buffer.byteLength(bytes)}))});
 const options={contentId:id,inputSha256:staged.inputSha256,readerOutcome:'読者が設定を判断する'};
 return {root,staged,options};
}
async function make(){const data=await input();return {...data,job:await initExistingArticleJob(data.root,repo,data.options)};}

describe('received AI Article Job creation',()=>{
 it('preserves original bytes and ID, binds the exact intake, and creates only a private CREATED attempt',async()=>{
  const {root,staged,job}=await make(),store=await readDraftStore(job.directory);
  expect(job.route).toBe(articleRoute(id));expect(job.state).toBe('CREATED');expect(job.productionEligible).toBe(false);
  expect(store.spec.target.contentId).toBe(id);expect(store.receivedInput?.inputSha256).toBe(staged.inputSha256);
  const ref=store.spec.inputs.localSourceRefs[0]!;
  expect(ref.artifactSha256).toBe(sha256(await readFile(join(root,ref.path),'utf8')));
  expect(store.spec.permissions).toEqual({networkAccess:false,externalTextAI:false,externalImageAI:false,
   localMediaProcessing:false,privateCanonicalMediaStorage:false,publicMediaUpload:false,protectedMediaOperation:false,repositoryExport:false});
  expect(await readFile(join(staged.directory,'objects',sha256(original)),'utf8')).toBe(original);
  const status=await attemptStatus(job.directory,store,repo);expect(status.current).toBe(true);
  expect(status.input).toContain('draft: true');expect(status.input).toContain('原文を再生成しません。');
  expect((await attemptStatus(job.directory,store,{...repo,commit:'c'.repeat(40)})).current).toBe(false);
  const files=await readdir(join(job.directory,'attempts',store.activeAttemptId));
  expect(files).toContain('received-draft.json');expect(files).not.toContain('human-draft.json');
  expect(files.some(f=>/semantic|approval|receipt/u.test(f))).toBe(false);
  expect(JSON.parse(await readFile(join(job.directory,'attempts',store.activeAttemptId,'received-draft.json'),'utf8')).producer).toBe('existing_ai');
  const preview=await buildDraftPreview(job.directory,repo);
  expect(preview.manifest.productionEligible).toBe(false);
  expect(preview.html).toContain('非公開・既成AI稿のMarkdown下書きpreview');
  expect(preview.html).not.toContain('手書きMarkdown');
 });
 it('rejects human-lane review, cloning and revision without changing the attempt',async()=>{
  const {root,job}=await make(),before=await readDraftStore(job.directory);
  await expect(contentReviewContext(job.directory,repo)).rejects.toThrow('EXISTING_AI_REVIEW_SCOPE_NOT_ADOPTED');
  await expect(reviseDraft(job.directory,repo,'human import','new body')).rejects.toThrow('EXISTING_AI_REVISION');
  await expect(initDraft(join(root,'.local/article-jobs'),repo,{intent:'publish',network:false,fromJob:job.jobId})).rejects.toThrow('EXISTING_AI_HUMAN_CLONE_DENIED');
  expect((await readDraftStore(job.directory)).activeAttemptId).toBe(before.activeAttemptId);
  const guide=await guideDraft(job.directory,repo,root);
  expect(guide.currentState).toBe('CREATED');expect(guide.blockers.join('\n')).toContain('EXISTING_AI_REVIEW_SCOPE_NOT_ADOPTED');
  expect(guide.next).not.toContain('sources import');
 });
 it('invalidates preview on an editor change without rewriting the received original',async()=>{
  const {staged,job}=await make(),store=await readDraftStore(job.directory);
  await writeFile(join(job.directory,'working.md'),(await readFile(join(job.directory,'working.md'),'utf8'))+'\n編集\n');
  expect((await attemptStatus(job.directory,store,repo)).current).toBe(false);
  await expect(buildDraftPreview(job.directory,repo)).rejects.toThrow('STALE');
  expect(await readFile(join(staged.directory,'objects',sha256(original)),'utf8')).toBe(original);
 });
 it('rejects a removed origin or a forged advanced state instead of claiming human approval',async()=>{
  const {job}=await make(),store=await readDraftStore(job.directory),path=join(job.directory,'job.json');
  const {receivedInput:_received,...withoutOrigin}=store;await writeFile(path,JSON.stringify(withoutOrigin));
  await expect(readDraftStore(job.directory)).rejects.toThrow('ORIGIN_BINDING');
  await writeFile(path,JSON.stringify(store));
  const attemptPath=join(job.directory,'attempts',store.activeAttemptId,'attempt.json');
  const attempt=JSON.parse(await readFile(attemptPath,'utf8'));await writeFile(attemptPath,JSON.stringify({...attempt,state:'HUMAN_APPROVED'}));
  await expect(attemptStatus(job.directory,store,repo)).rejects.toThrow('BINDING');
 });
 it.each(['manifest','object','artifact'] as const)('rejects changed %s bytes at readback',async(kind)=>{
  const {staged,job}=await make(),store=await readDraftStore(job.directory);
  if(kind==='manifest'){
   const path=join(staged.directory,'intake.json'),data=JSON.parse(await readFile(path,'utf8'));
   data.input.baseCommit='c'.repeat(40);await writeFile(path,JSON.stringify(data));
   await expect(readDraftStore(job.directory)).rejects.toThrow('BINDING');
  }else if(kind==='object'){
   await writeFile(join(staged.directory,'objects',sha256(original)),original+'changed');
   await expect(readDraftStore(job.directory)).rejects.toThrow('BYTES_MISMATCH');
  }else{
   const path=join(job.directory,'attempts',store.activeAttemptId,'received-draft.json'),data=JSON.parse(await readFile(path,'utf8'));
   data.input.inputSha256='d'.repeat(64);await writeFile(path,JSON.stringify(data));
   await expect(attemptStatus(job.directory,store,repo)).rejects.toThrow('BINDING');
  }
 });
 it('rejects changed repository, duplicate identity and occupied route before allocating a job',async()=>{
  const {root,options}=await input();
  await expect(initExistingArticleJob(root,{...repo,commit:'c'.repeat(40)},options)).rejects.toThrow('REPOSITORY_CHANGED');
  await expect(initExistingArticleJob(root,{...repo,occupiedRoutes:[articleRoute(id)]},options)).rejects.toThrow('CONTENT_ID_COLLISION');
  await expect(initExistingArticleJob(root,{...repo,records:[{contentId:id,collection:'blog',slug:'existing',route:articleRoute(id),source:original,sourceSha256:sha256(original),registrySha256:fingerprint(repo.registrySnapshot)}]},options)).rejects.toThrow('CONTENT_ID_COLLISION');
  expect((await readdir(join(root,'.local/article-jobs'))).filter(f=>f.startsWith('job-'))).toEqual([]);
 });
 it('exposes explicit CLI creation with no publication/network option and keeps human review blocked',async()=>{
  const {root,options}=await input(),messages:any[]=[];
  const args=['article','existing-input','init','--content-id',id,'--input-sha256',options.inputSha256,'--reader-outcome',options.readerOutcome];
  expect(await articleCli([...args,'--intent','publish'],root,async()=>repo,v=>messages.push(v))).toBe(2);
  expect(await articleCli(args,root,async()=>repo,v=>messages.push(v))).toBe(0);
  const job=messages.at(-1);expect(job.origin).toBe('existing_ai');
  expect(await articleCli(['article','audit','prepare','--job',job.jobId],root,async()=>repo,v=>messages.push(v))).toBe(3);
  expect(messages.at(-1).error.code).toBe('EXISTING_AI_REVIEW_SCOPE_NOT_ADOPTED');
 });
});
