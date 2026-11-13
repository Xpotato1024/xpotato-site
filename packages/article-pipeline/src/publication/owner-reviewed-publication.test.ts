import {it,expect,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {stringify} from 'yaml';
import {articleRoute,articleUrlId} from '@xpotato/content-contracts';
import {publishCiPackage,type CiPublicationContext} from './ci-publication.js';
import type {PublicationStorage,PublishObject} from '../media/r2-sdk-store.js';
import sharp from 'sharp';
import {articleMediaTargetsSha256} from '@xpotato/content-contracts/article-media-targets';
import {stageExistingArticleInput} from '../existing-article-intake.js';
import {initExistingArticleJob,readDraftStore,splitDraft,type DraftRepository} from '../draft-job.js';
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
async function setup(options?:{directory:string;repository:DraftRepository;document:string}){
 const dir=options?.directory??await mkdtemp(join(tmpdir(),'owner-producer-'));if(!options)roots.push(dir);
 const selectedRepo=options?.repository??repo;
 const source=join(dir,'.local/existing-article-sources/fixture');await mkdir(source,{recursive:true});
 for(const name of ['independent-article-audit','independent-visual-audit']){
  await mkdir(join(dir,'.agents/skills',name),{recursive:true});
  await writeFile(join(dir,'.agents/skills',name,'SKILL.md'),await readFile(join(root,'.agents/skills',name,'SKILL.md')));
 }
 const document=options?.document??'---\nid: '+id+'\ntitle: 既成AI稿の本人確認fixture\ndescription: Synthetic owner publication test\npubDate: 2026-11-01\ncategory: software\ntags: []\ndraft: false\n---\n'+fixtureReviewBody;
 const image=await sharp({create:{width:320,height:180,channels:3,background:'white'}}).png().toBuffer(),history=Buffer.from('Synthetic historical generated-image lineage; not a real model receipt.');
 const entries=[{id:'manuscript',role:'manuscript',path:'article.mdx',origin:'ai_generated',lineageIds:['history'],bytes:Buffer.from(document)},
  {id:'hero',role:'hero',path:'hero.png',origin:'ai_generated',lineageIds:['history'],bytes:image},
  {id:'history',role:'lineage',path:'history.txt',origin:'user_supplied',lineageIds:[],bytes:history}];
 for(const e of entries)await writeFile(join(source,e.path),e.bytes);
 const staged=await stageExistingArticleInput(dir,source,{schemaVersion:1,protocol:'xpotato-existing-article-input-v1',contentId:id,baseCommit:selectedRepo.commit,
  artifacts:entries.map(({bytes,...e})=>({...e,sha256:sha256(bytes),sizeBytes:bytes.length}))});
 const job=await initExistingArticleJob(dir,selectedRepo,{...(options?{updateKind:'correction'}:{}),contentId:id,inputSha256:staged.inputSha256,readerOutcome:'fixture',intent:'publish',localMediaProcessing:true});
 const f=fixtureReviewInputs(),sources={...f.sources,scope:'existing_ai',authorPrincipalId:'historical-ai-author',existingInput:{inputSha256:staged.inputSha256,manuscriptSha256:sha256(document)}};
 await importReviewSources(job.directory,selectedRepo,sources);await importReviewEvidence(job.directory,selectedRepo,{...f.evidence,sourceBundleSha256:fingerprint(sources)});await prepareContentAudit(job.directory,selectedRepo);
 await mkdir(join(job.directory,'source-media'));await writeFile(join(job.directory,'source-media/hero.png'),image);
 const visual={schemaVersion:1,hero:{kind:'local_raster',assetId:'article-hero',path:'source-media/hero.png',sha256:sha256(image),origin:'ai_generated',alt:'Synthetic decorative fixture',decorative:true,
  rights:{schemaVersion:1,rightsId:'fixture-hero-rights',basis:'ai_generated_authorized',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-11-01T00:00:00Z'},
  receivedLineage:{artifactId:'hero',lineageSha256:sha256(history)}},inline:[],
  mediaPlan:{schemaVersion:1,scope:'existing_ai',profileId:'article-media-targets-v1',profileSha256:articleMediaTargetsSha256,
   confirmation:{kind:'human',principalId:'fixture-plan-operator',confirmedProfileSha256:articleMediaTargetsSha256,confirmedAt:'2026-11-01T00:00:00Z',purpose:'candidate_planning_only'}}};
 return {job,visual,directory:dir};
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

it('prepares an owner-reviewed correction from immutable intake and actual Git preimages, then exports via mock A/B/C',async()=>{
 const f=await setup(),prepared=await prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual);
 const firstBundle=await prepareOwnerReviewedPublicationBundle(prepared.handle,await attestOwnerReviewedConversation(prepared.handle,evidence(prepared.subject)));
 const map=new Map<string,PublishObject>(),calls:string[]=[];
 const storage:PublicationStorage={configurationSha256:'a'.repeat(64),
  read:async o=>{calls.push('GET '+o.plane);const a=map.get(o.plane+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},
  putIfAbsent:async o=>{calls.push('PUT '+o.plane);map.set(o.plane+o.key,o);return 'uploaded';},
  readPublic:async o=>{const a=map.get('public'+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},close(){}};
 const context:CiPublicationContext={repository:'Xpotato1024/xpotato-site',event:'workflow_dispatch',ref:'refs/heads/main',actor:'Xpotato1024',triggeringActor:'Xpotato1024',environment:'site-production',runId:'123',attempt:1,sourceSha:repo.commit};
 const slug=articleUrlId(id),path='apps/site/src/content/blog/'+slug+'.mdx',base:Record<string,string|null>={[path]:null};
 for(const n of ['media','provenance','media-rights'])base['apps/site/src/content-registry/'+n+'/blog/'+id+'.json']=null;
 base['apps/site/src/content-registry/media/index.ts']='export const mediaRegistries = Object.freeze([]);\n';
 base['apps/site/src/content-registry/provenance/index.ts']='export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([]);\n';
 base['apps/site/src/content-registry/media-rights/index.ts']=null;
 const first=await publishCiPackage(firstBundle.package,{repo,base,storage,context,admission:firstBundle.admission,packageSha256:sha256(firstBundle.bytes),mode:'publish',now:()=>new Date('2026-11-02T00:00:00Z')});
 const nextBase=Object.fromEntries(first.changes.map(c=>[c.path,c.after]));
 for(const c of first.changes){await mkdir(dirname(join(f.directory,c.path)),{recursive:true});await writeFile(join(f.directory,c.path),c.after!);}
 // Only synthetic public fixture files are committed, never private test Jobs.
 const git=(...args:string[])=>execFileSync('git',['-C',f.directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','--quiet');git('config','core.autocrlf','false');git('add','--',...first.changes.map(c=>c.path));
 git('-c','user.name=Synthetic test','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Synthetic owner-reviewed previous publication');
 const commit=git('rev-parse','HEAD'),previous=nextBase[path]!,fm=splitDraft(previous).frontmatter;
 const registrySnapshot=Object.fromEntries(Object.entries(nextBase).filter(([p])=>p.startsWith('apps/site/src/content-registry/')).map(([p,t])=>[p,t!]));
 const nextRepo:DraftRepository={...repo,commit,fingerprint:fingerprint({commit,registrySnapshot}),registrySnapshot,occupiedRoutes:[articleRoute(id)],
  records:[{contentId:id,collection:'blog',slug,route:articleRoute(id),source:previous,sourceSha256:sha256(previous),registrySha256:fingerprint(registrySnapshot)}]};
 const document='---\n'+stringify({...fm,title:fm.title+'（訂正fixture）',draft:false})+'---\n'+fixtureReviewBody;
 const second=await setup({directory:f.directory,repository:nextRepo,document});
 // Copy only the real deterministic renderer's public assets into the test root.
 await mkdir(join(f.directory,'apps/site/src/styles'),{recursive:true});
 await cp(join(root,'apps/site/src/styles/fonts.css'),join(f.directory,'apps/site/src/styles/fonts.css'));
 await cp(join(root,'apps/site/public/fonts'),join(f.directory,'apps/site/public/fonts'),{recursive:true});
 await cp(join(root,'apps/site/public/xpotato-logo.svg'),join(f.directory,'apps/site/public/xpotato-logo.svg'));
 const subject=await prepareOwnerPublicationSubject(second.job.directory,nextRepo,f.directory,second.visual);
 const bundle=await prepareOwnerReviewedPublicationBundle(subject.handle,await attestOwnerReviewedConversation(subject.handle,evidence(subject.subject)));
 expect(bundle.package.revision).toMatchObject({kind:'correction',previous:{commit,fileSlug:slug,route:articleRoute(id),pubDate:fm.pubDate,mdxSha256:sha256(previous)}});
 calls.length=0;
 const result=await publishCiPackage(bundle.package,{repo:nextRepo,base:nextBase,storage,context:{...context,sourceSha:commit},repositoryRoot:f.directory,
  admission:bundle.admission,packageSha256:sha256(bundle.bytes),mode:'publish',now:()=>new Date('2026-11-03T00:00:00Z')});
 const after=result.changes.find(c=>c.path===path)!,updated=splitDraft(after.after!).frontmatter;
 expect(updated).toMatchObject({id,pubDate:fm.pubDate,updatedDate:'2026-11-03'});expect(result.provenance.content.route).toBe(articleRoute(id));
 expect(result.provenance.articleJob).toMatchObject({reviewBasis:'owner_reviewed',ownerReview:{origin:'existing_ai'}});
 expect(result).toMatchObject({storageVerified:true,canonicalFilesApplied:false,articleDeployed:false});expect(result.rollback).toBeDefined();
 expect(calls.some(c=>c==='PUT protected')).toBe(true);
 calls.length=0;
 await expect(publishCiPackage(bundle.package,{repo:nextRepo,base:{...nextBase,[path]:previous+'\nchanged'},storage,context:{...context,sourceSha:commit},repositoryRoot:f.directory,
  admission:bundle.admission,packageSha256:sha256(bundle.bytes),mode:'publish'})).rejects.toThrow('BASE_CONFLICT');
 expect(calls).toEqual([]);
},60000);

it('binds display-only social lines through preparation, readback and owner proof without rewriting intake',async()=>{
 const f=await setup(),before=await readFile(join(f.job.directory,'working.md'),'utf8'),fm=splitDraft(before).frontmatter;
 const old=await prepareOwnerPublicationSubject(f.job.directory,repo,root,f.visual);
 const visual={...f.visual,socialCardDisplay:{titleSha256:sha256(fm.title),lines:['既成AI稿の','本人確認fixture']}};
 const p=await prepareOwnerPublicationSubject(f.job.directory,repo,root,visual);
 expect(p.subject.manuscriptSha256).toBe(old.subject.manuscriptSha256);expect(p.subject.frontmatterSha256).toBe(old.subject.frontmatterSha256);
 expect(p.subject.bodySha256).toBe(old.subject.bodySha256);expect(p.subject.reviewedMedia).toEqual(old.subject.reviewedMedia);
 expect(p.subject.generatorBindingSha256).not.toBe(old.subject.generatorBindingSha256);expect(p.subject.planSha256).not.toBe(old.subject.planSha256);
 expect(p.subject.subjectSha256).not.toBe(old.subject.subjectSha256);
 const staleProof=await attestOwnerReviewedConversation(old.handle,evidence(old.subject));
 await expect(prepareOwnerReviewedPublicationBundle(p.handle,staleProof)).rejects.toThrow();
 const proof=await attestOwnerReviewedConversation(p.handle,evidence(p.subject));
 const bundle=await prepareOwnerReviewedPublicationBundle(p.handle,proof);
 expect((await prepareStoredOwnerReviewedPublicationBundle(f.job.directory,repo,root)).package.semanticSha256).toBe(bundle.package.semanticSha256);
 expect(splitDraft(bundle.package.mdx).frontmatter).not.toHaveProperty('cardDisplay');
 expect(await readFile(join(f.job.directory,'working.md'),'utf8')).toBe(before);
 const path=join(f.job.directory,'owner-publication-preparation.json'),saved=JSON.parse(await readFile(path,'utf8'));
 saved.visualInput.socialCardDisplay.lines=['既成AI稿の本人確認','fixture'];await writeFile(path,JSON.stringify(saved));
 await expect(restoreOwnerPublicationPreparation(f.job.directory,repo,root)).rejects.toThrow('PREPARATION_STALE');
 await expect(prepareStoredOwnerReviewedPublicationBundle(f.job.directory,repo,root)).rejects.toThrow('PREPARATION_STALE');
},60000);
it('rejects social text/hash changes before issuing an owner preparation',async()=>{
 const f=await setup(),title=splitDraft(await readFile(join(f.job.directory,'working.md'),'utf8')).frontmatter.title;
 await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,{...f.visual,socialCardDisplay:{titleSha256:'e'.repeat(64),lines:[title]}})).rejects.toThrow('SOCIAL_TITLE_BINDING_INVALID');
 await expect(prepareOwnerPublicationSubject(f.job.directory,repo,root,{...f.visual,socialCardDisplay:{titleSha256:sha256(title),lines:['別のタイトル']}})).rejects.toThrow();
 expect((await readdir(f.job.directory)).includes('owner-publication-preparation.json')).toBe(false);
});
