import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {articleRoute} from '@xpotato/content-contracts';
import {fingerprint,sha256} from './canonical.js';
import {stageExistingArticleInput} from './existing-article-intake.js';
import {initExistingArticleJob,initDraft,readDraftStore,attemptStatus,reviseDraft,guideDraft,type DraftRepository} from './draft-job.js';
import {buildDraftPreview} from './draft-preview.js';
import {contentReviewContext,importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit} from './content-review.js';
import {fixtureReviewBody,fixtureReviewInputs} from './content-review-fixture.js';
import {validateContentAudit} from './review-analysis.js';
import {prepareExistingAuditInvocation} from './existing-audit-invocation.js';
import {articleCli} from './cli.js';
import {existingAuditReferencePaths} from './existing-audit-material.js';

const id='11111111-1111-4111-8111-111111111111',roots:string[]=[];
const repo:DraftRepository={commit:'a'.repeat(40),fingerprint:'b'.repeat(64),categories:[{id:'software',label:'ソフトウェア',status:'active'}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:'empty'}};
const original="---\nid: "+id+"\ntitle: 既成AI稿\ndescription: 保存済み原稿の説明\npubDate: '2026-10-28'\ncategory: software\ntags: []\ndraft: false\n---\n## 本文\n\n原文を再生成しません。\n";
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function input(document=original){
 const root=await mkdtemp(join(tmpdir(),'existing-job-'));roots.push(root);
 const source=join(root,'.local/existing-article-sources');await mkdir(source,{recursive:true});
 for(const skill of ['independent-article-audit','independent-visual-audit']){
  await mkdir(join(root,'.agents/skills',skill),{recursive:true});
  await writeFile(join(root,'.agents/skills',skill,'SKILL.md'),await readFile(join(process.cwd(),'.agents/skills',skill,'SKILL.md')));
 }
 const files=[{id:'manuscript',role:'manuscript',path:'article.mdx',origin:'ai_generated',lineageIds:['history'],bytes:document},
  {id:'hero',role:'hero',path:'hero.txt',origin:'ai_generated',lineageIds:['history'],bytes:'received hero bytes'},
  {id:'history',role:'lineage',path:'history.json',origin:'user_supplied',lineageIds:[],bytes:'{"observed":"historical, unreviewed"}'}];
 for(const file of files)await writeFile(join(source,file.path),file.bytes);
 const staged=await stageExistingArticleInput(root,source,{schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,
  baseCommit:repo.commit,artifacts:files.map(({bytes,...file})=>({...file,sha256:sha256(bytes),sizeBytes:Buffer.byteLength(bytes)}))});
 const options={contentId:id,inputSha256:staged.inputSha256,readerOutcome:'読者が設定を判断する'};
 return {root,staged,options};
}
async function make(document=original){const data=await input(document);return {...data,job:await initExistingArticleJob(data.root,repo,data.options)};}

describe('received AI Article Job creation',()=>{
 it('creates a separate publication-intent Job without rewriting the review Job or granting operational approval',async()=>{
  const data=await make(),before=await readDraftStore(data.job.directory);
  const pub=await initExistingArticleJob(data.root,repo,{...data.options,intent:'publish'});
  const store=await readDraftStore(pub.directory);
  expect(pub.jobId).not.toBe(data.job.jobId);expect(store.jobFingerprint).not.toBe(before.jobFingerprint);
  expect(store.spec.permissions).toMatchObject({privateCanonicalMediaStorage:true,publicMediaUpload:true,protectedMediaOperation:true,repositoryExport:true,
   externalTextAI:false,externalImageAI:false,networkAccess:false});
  expect((await readDraftStore(data.job.directory)).spec.permissions.repositoryExport).toBe(false);
  expect(store.receivedInput?.kind).toBe('existing_ai');expect(pub.productionEligible).toBe(false);
  expect(await readFile(join(pub.directory,'working.md'),'utf8')).toBe(await readFile(join(data.job.directory,'working.md'),'utf8'));
  expect((await guideDraft(pub.directory,repo,data.root)).blockers.some(x=>x.startsWith('LIVE_MEDIA_GATE_CLOSED'))).toBe(true);
 });
 it('grants audit-only use of an existing login only when explicit, and pins exact references without storage authority',async()=>{
  const data=await input();
  for(const path of existingAuditReferencePaths){const {dirname}=await import('node:path');await mkdir(dirname(join(data.root,path)),{recursive:true});await writeFile(join(data.root,path),await readFile(join(process.cwd(),path)));}
  const job=await initExistingArticleJob(data.root,repo,{...data.options,existingLoginAudit:{authorizedBy:'user',purpose:'independent_review_only'}});
  const store=await readDraftStore(job.directory),ref=store.spec.inputs.localSourceRefs.find(r=>r.inputId==='existing-audit-references')!;
  expect(store.spec.permissions).toMatchObject({networkAccess:true,externalTextAI:true,externalImageAI:false,privateCanonicalMediaStorage:false,publicMediaUpload:false,protectedMediaOperation:false,repositoryExport:false});
  expect(store.spec.externalAiDisclosure.explicitAuthorizations).toEqual([{inputRef:'existing-audit-input',requestedMode:'allow_exact',authorizedBy:'user'}]);
  expect(sha256(await readFile(join(job.directory,'base','audit-references.json')))).toBe(ref.artifactSha256);
  expect((await attemptStatus(job.directory,store,repo)).current).toBe(true);
  await expect(readFile(join(job.directory,'audit-disclosure-grants'))).rejects.toThrow();
 });
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
  // An unrelated repository commit is not a changed article/audit subject.
  expect((await attemptStatus(job.directory,store,{...repo,commit:'c'.repeat(40)})).current).toBe(true);
  expect((await attemptStatus(job.directory,store,{...repo,fingerprint:'c'.repeat(64)})).current).toBe(false);
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
  expect((await contentReviewContext(job.directory,repo)).journal.state).toBe('CREATED');
  await expect(importReviewSources(job.directory,repo,{schemaVersion:1,scope:'human_local',authorPrincipalId:'writer',sources:[]})).rejects.toThrow('EXISTING_AI_REVIEW_INPUT_BINDING_INVALID');
  await expect(reviseDraft(job.directory,repo,'human import','new body')).rejects.toThrow('EXISTING_AI_REVISION');
  await expect(initDraft(join(root,'.local/article-jobs'),repo,{intent:'publish',network:false,fromJob:job.jobId})).rejects.toThrow('EXISTING_AI_HUMAN_CLONE_DENIED');
  expect((await readDraftStore(job.directory)).activeAttemptId).toBe(before.activeAttemptId);
  const guide=await guideDraft(job.directory,repo,root);
  expect(guide.currentState).toBe('CREATED');expect(guide.blockers.join('\n')).not.toContain('EXISTING_AI_REVIEW_SCOPE_NOT_ADOPTED');
  expect(guide.next).toContain('sources import');
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
 it('requires explicit publication intent, rejects network overrides and keeps unaudited review blocked',async()=>{
  const {root,options}=await input(),messages:any[]=[];
  const args=['article','existing-input','init','--content-id',id,'--input-sha256',options.inputSha256,'--reader-outcome',options.readerOutcome];
  expect(await articleCli([...args,'--intent','invalid'],root,async()=>repo,v=>messages.push(v))).toBe(2);
  expect(await articleCli([...args,'--network','enabled'],root,async()=>repo,v=>messages.push(v))).toBe(2);
  expect(await articleCli([...args,'--intent','publish','--network','enabled'],root,async()=>repo,v=>messages.push(v))).toBe(0);
  expect((await readDraftStore(messages.at(-1).directory)).spec.permissions).toMatchObject({repositoryExport:true,networkAccess:true,externalTextAI:false,externalImageAI:false});
  expect(await articleCli(args,root,async()=>repo,v=>messages.push(v))).toBe(0);
  const job=messages.at(-1);expect(job.origin).toBe('existing_ai');
  expect(await articleCli(['article','audit','prepare','--job',job.jobId],root,async()=>repo,v=>messages.push(v))).toBe(3);
  expect(messages.at(-1).error.code).toBe('CONTENT_AUDIT_PREREQUISITES_MISSING');
 });
 it('prepares exact received-input review and rejects even a self-consistent fabricated agent observation',async()=>{
  const document=original.slice(0,original.indexOf('## 本文'))+fixtureReviewBody;
  const {job,staged}=await make(document),store=await readDraftStore(job.directory),f=fixtureReviewInputs();
  const sources={...f.sources,scope:'existing_ai' as const,authorPrincipalId:'historical-ai-author',
   existingInput:{inputSha256:staged.inputSha256,manuscriptSha256:sha256(document)}};
  await expect(importReviewSources(job.directory,repo,{...sources,existingInput:{...sources.existingInput,inputSha256:'c'.repeat(64)}})).rejects.toThrow('INPUT_BINDING');
  await importReviewSources(job.directory,repo,sources);
  await importReviewEvidence(job.directory,repo,{...f.evidence,sourceBundleSha256:fingerprint(sources)});
  const {request}=await prepareContentAudit(job.directory,repo),context='22222222-2222-4222-8222-222222222222',reviewedAt=new Date().toISOString();
  const status=await attemptStatus(job.directory,store,repo);
  const prepareArgs={directory:job.directory,repo,repositoryRoot:process.cwd(),attemptId:store.activeAttemptId,
   inputSha256:status.inputSha256,spec:store.spec,request:{stage:'content_audit'},auditTargetArtifactId:'audit-target',artifacts:[]};
  // Unknown/self-consistent target JSON cannot select a different attempt or
  // replace the real journal auditRequest with a minimal invented target.
  await expect(prepareExistingAuditInvocation({...prepareArgs,attemptId:'other'} as any)).rejects.toThrow('JOB_BINDING');
  await expect(prepareExistingAuditInvocation({...prepareArgs,inputSha256:'d'.repeat(64)} as any)).rejects.toThrow('JOB_BINDING');
  await expect(prepareExistingAuditInvocation(prepareArgs as any)).rejects.toThrow('PHYSICAL_TARGET_MISSING');
  const raw={schemaVersion:1,scope:'existing_ai',requestSha256:request.requestSha256,
   reviewer:{kind:'agent',principalId:'agent-'+context},independence:{separateReview:true,authorIdentityConfirmed:true,basis:'Synthetic hosted-agent regression fixture; not an actual audit.'},
   coveredClaimIds:['c0001'],materialCoverage:'complete',findings:[],conclusion:'pass',reviewedAt};
  const execution={protocol:'xpotato-private-hosted-agent-audit-observation-v1',contextRef:'codex-thread:'+context,freshContext:true,
   stage:'content',skillId:'independent-article-audit',skillSha256:request.skill!.skillSha256,requestSha256:request.requestSha256,
   responseSha256:fingerprint(raw),completedAt:reviewedAt};
  const audit={...raw,reviewer:{...raw.reviewer,execution}};
  expect(()=>validateContentAudit({...raw,reviewer:{kind:'human',principalId:'human-auditor'}},request)).toThrow();
  for(const change of [{requestSha256:'c'.repeat(64)},{skillSha256:'c'.repeat(64)},{responseSha256:'c'.repeat(64)},{stage:'visual'},{freshContext:false}]){
   expect(()=>validateContentAudit({...audit,reviewer:{...audit.reviewer,execution:{...execution,...change}}},request)).toThrow();
  }
  await expect(importContentAudit(job.directory,repo,audit)).rejects.toThrow('AGENT_AUDIT_TRUSTED_EXECUTION_REQUIRED');
  expect((await guideDraft(job.directory,repo)).currentState).toBe('EXAMPLES_ASSESSED');
  expect((await readDraftStore(job.directory)).activeAttemptId).toBe(store.activeAttemptId);
 });
});
