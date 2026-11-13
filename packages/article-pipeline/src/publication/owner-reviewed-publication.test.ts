import {it,expect,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import sharp from 'sharp';
import {articleMediaTargetsSha256} from '@xpotato/content-contracts/article-media-targets';
import {stageExistingArticleInput} from '../existing-article-intake.js';
import {initExistingArticleJob,readDraftStore,type DraftRepository} from '../draft-job.js';
import {importReviewSources,importReviewEvidence,prepareContentAudit} from '../review/content-review.js';
import {fixtureReviewBody,fixtureReviewInputs} from '../review/content-review-fixture.js';
import {fingerprint,sha256} from '../canonical.js';
import {prepareOwnerPublicationSubject,prepareOwnerReviewedPublicationBundle,restoreOwnerPublicationPreparation,prepareStoredOwnerReviewedPublicationBundle} from './owner-reviewed-publication.js';
import {attestOwnerReviewedConversation,withdrawOwnerReview,ownerReviewDerivations,type OwnerReviewSubject} from './owner-review-evidence.js';
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
const id='11111111-1111-4111-8111-111111111111',root=resolve('.');
const repo:DraftRepository={commit:'a'.repeat(40),fingerprint:'b'.repeat(64),categories:[{id:'software',label:'ソフトウェア',status:'active'}],tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:'empty'}};
function evidence(s:OwnerReviewSubject){
 const text='Synthetic fixture acceptance only, no real owner instruction.';
 return {source:{kind:'operator_attested_authenticated_owner_conversation',channel:'chatgpt',conversationRef:'fixture-conversation',
  messageRefs:['fixture-accept'],acceptanceMessageRef:'fixture-accept',messageCreatedAt:'2026-11-01T00:00:00Z',
  verbatimStatement:text,statementSha256:sha256(text),ownerIdentityChecked:true,operatorId:'fixture-operator'},
  decision:'accept_exact_previously_reviewed_content_and_figures',selectedVersion:'fixture-v1',reviewedContentSha256:s.manuscriptSha256,
  reviewedMedia:s.reviewedMedia,reviewedFigureOrder:s.figureOrder,permittedDerivations:[...ownerReviewDerivations]};
}
async function setup(){
 const dir=await mkdtemp(join(tmpdir(),'owner-producer-'));roots.push(dir);
 const source=join(dir,'.local/existing-article-sources/fixture');await mkdir(source,{recursive:true});
 for(const name of ['independent-article-audit','independent-visual-audit']){
  await mkdir(join(dir,'.agents/skills',name),{recursive:true});
  await writeFile(join(dir,'.agents/skills',name,'SKILL.md'),await readFile(join(root,'.agents/skills',name,'SKILL.md')));
 }
 const document='---\nid: '+id+'\ntitle: 既成AI稿の本人確認fixture\ndescription: Synthetic owner publication test\npubDate: 2026-11-01\ncategory: software\ntags: []\ndraft: false\n---\n'+fixtureReviewBody;
 const image=await sharp({create:{width:320,height:180,channels:3,background:'white'}}).png().toBuffer(),history=Buffer.from('Synthetic historical generated-image lineage; not a real model receipt.');
 const entries=[{id:'manuscript',role:'manuscript',path:'article.mdx',origin:'ai_generated',lineageIds:['history'],bytes:Buffer.from(document)},
  {id:'hero',role:'hero',path:'hero.png',origin:'ai_generated',lineageIds:['history'],bytes:image},
  {id:'history',role:'lineage',path:'history.txt',origin:'user_supplied',lineageIds:[],bytes:history}];
 for(const e of entries)await writeFile(join(source,e.path),e.bytes);
 const staged=await stageExistingArticleInput(dir,source,{schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,baseCommit:repo.commit,
  artifacts:entries.map(({bytes,...e})=>({...e,sha256:sha256(bytes),sizeBytes:bytes.length}))});
 const job=await initExistingArticleJob(dir,repo,{contentId:id,inputSha256:staged.inputSha256,readerOutcome:'fixture',intent:'publish',localMediaProcessing:true});
 const f=fixtureReviewInputs(),sources={...f.sources,scope:'existing_ai',authorPrincipalId:'historical-ai-author',existingInput:{inputSha256:staged.inputSha256,manuscriptSha256:sha256(document)}};
 await importReviewSources(job.directory,repo,sources);await importReviewEvidence(job.directory,repo,{...f.evidence,sourceBundleSha256:fingerprint(sources)});await prepareContentAudit(job.directory,repo);
 await mkdir(join(job.directory,'source-media'));await writeFile(join(job.directory,'source-media/hero.png'),image);
 const visual={schemaVersion:1,hero:{kind:'local_raster',assetId:'article-hero',path:'source-media/hero.png',sha256:sha256(image),origin:'ai_generated',alt:'Synthetic decorative fixture',decorative:true,
  rights:{schemaVersion:1,rightsId:'fixture-hero-rights',basis:'ai_generated_authorized',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-11-01T00:00:00Z'},
  receivedLineage:{artifactId:'hero',lineageSha256:sha256(history)}},inline:[],
  mediaPlan:{schemaVersion:1,scope:'existing_ai',profileId:'article-media-targets-v1',profileSha256:articleMediaTargetsSha256,
   confirmation:{kind:'human',principalId:'fixture-plan-operator',confirmedProfileSha256:articleMediaTargetsSha256,confirmedAt:'2026-11-01T00:00:00Z',purpose:'candidate_planning_only'}}};
 return {job,visual};
}
it('prepares a real local owner package without inventing audit PASS or changing the legacy Job/journal',async()=>{
 const f=await setup(),store=await readDraftStore(f.job.directory),head=join(f.job.directory,'attempts',store.activeAttemptId,'review/head.json');
 const before=await Promise.all([head,join(f.job.directory,'job.json'),join(f.job.directory,'working.md')].map(p=>readFile(p,'utf8')));
 const p=await prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual);
 expect(p.ownerConfirmed).toBe(false);expect(p.storageWrites).toBe(0);
 await expect(prepareOwnerReviewedPublicationBundle(p.handle,{protocol:'xpotato-owner-review-proof-handle-v1'})).rejects.toThrow('OPERATOR_PROOF_REQUIRED');
 await expect(prepareStoredOwnerReviewedPublicationBundle(f.job.directory,repo,root)).rejects.toThrow();
 const proof=await attestOwnerReviewedConversation(p.handle,evidence(p.subject)),bundle=await prepareOwnerReviewedPublicationBundle(p.handle,proof);
 expect(bundle.publicationApproved).toBe(false);expect(bundle.package.scope).toBe('existing_ai');
 expect(bundle.package.evidence).toMatchObject({reviewBasis:'owner_reviewed'});expect(bundle.package.evidence).not.toHaveProperty('contentAuditSha256');
 expect(bundle.package.evidence).not.toHaveProperty('visualAuditSha256');expect(bundle.package.aiRuns).toEqual([]);
 expect(bundle.package.registry.assets.every(a=>a.ownerReviewRef&&!a.visualAuditRef)).toBe(true);
 expect(bundle.admission.producer).toBe('verified-owner-reviewed-existing-ai-prepare-v1');
 expect(bundle.bytes.toString()).not.toMatch(/fixture-conversation|fixture-accept|Synthetic fixture acceptance|ownerIdentityChecked/);
 expect(await Promise.all([head,join(f.job.directory,'job.json'),join(f.job.directory,'working.md')].map(p=>readFile(p,'utf8')))).toEqual(before);
 expect((await readdir(f.job.directory)).includes('audit-runtime')).toBe(false);
 expect((await prepareStoredOwnerReviewedPublicationBundle(f.job.directory,repo,root)).package.semanticSha256).toBe(bundle.package.semanticSha256);
 const source={...evidence(p.subject).source,acceptanceMessageRef:'fixture-withdraw',messageRefs:['fixture-withdraw'],messageCreatedAt:'2026-11-02T00:00:00Z'};
 await withdrawOwnerReview(p.handle,source);await expect(prepareStoredOwnerReviewedPublicationBundle(f.job.directory,repo,root)).rejects.toThrow('WITHDRAWN');
},60000);
it.each(['sources','evidence'] as const)('rejects stale working %s before owner preparation',async(role)=>{
 const f=await setup(),p=join(f.job.directory,'working-'+role+'.json'),raw=JSON.parse(await readFile(p,'utf8'));
 await writeFile(p,JSON.stringify({...raw,unexpected:'changed'}));
 await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual)).rejects.toThrow('SOURCE_CHANGED');
});
it('rejects unproven image mapping and unconfirmed storage plan before producing an owner subject',async()=>{
 const f=await setup();await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,{...f.visual,hero:{...f.visual.hero,sha256:'e'.repeat(64)}})).rejects.toThrow('SOURCE_MAPPING_REQUIRED');
 await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,{...f.visual,mediaPlan:null})).rejects.toThrow('STORAGE_PLAN_REQUIRED');
});

it.each(['sources','evidence'] as const)('rechecks changed working %s after operator evidence was recorded',async(role)=>{
 const f=await setup(),p=await prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual),proof=await attestOwnerReviewedConversation(p.handle,evidence(p.subject));
 const path=join(f.job.directory,'working-'+role+'.json'),raw=JSON.parse(await readFile(path,'utf8'));await writeFile(path,JSON.stringify({...raw,unexpected:'changed'}));
 await expect(prepareOwnerReviewedPublicationBundle(p.handle,proof)).rejects.toThrow('SOURCE_CHANGED');
},60000);
it.each(['missing','corrupted'] as const)('rejects %s source-stage history instead of claiming historical lineage',async(kind)=>{
 const f=await setup(),store=await readDraftStore(f.job.directory),folder=join(f.job.directory,'attempts',store.activeAttemptId,'review');
 const head=JSON.parse(await readFile(join(folder,'head.json'),'utf8')),path=join(folder,'receipts',head.receipts[0]+'.json');
 if(kind==='missing')await rm(path);else{const raw=JSON.parse(await readFile(path,'utf8'));raw.inputSha256='e'.repeat(64);await writeFile(path,JSON.stringify(raw));}
 await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual)).rejects.toThrow();
});
