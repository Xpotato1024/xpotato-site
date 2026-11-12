import {it,expect,vi,afterEach} from 'vitest';import {parse,stringify} from 'yaml';import sharp from 'sharp';
import {prepareCiPublicationBundle,publicationSemanticIdentity,validateCiPublicationPackage,validateCiPublicationMedia,type CiPublicationPackage} from './ci-publication-package.js';
import * as visualSnapshot from '../visual/visual-review.js';
import * as candidateCompiler from '../candidate/candidate-material.js';
import * as journal from '../review/review-journal.js';
afterEach(()=>vi.restoreAllMocks());
import {publishCiPackage,publicationMdx,type CiPublicationContext} from './ci-publication.js';
import {preparePublicationRevision,revisionPaths} from './publication-revision.js';
import {articleRoute,articleUrlId} from '@xpotato/content-contracts';
import {splitDraft} from '../draft-job.js';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
import {sha256,canonicalJson} from "../canonical.js";import type {DraftRepository} from "../draft-job.js";import type {PublicationStorage,PublishObject} from "../media/r2-sdk-store.js";
const id='00000000-0000-4000-8000-000000000001',h='a'.repeat(64),commit='b'.repeat(40);
const images=await Promise.all([675,630].map(async height=>({source:await sharp({create:{width:1200,height,channels:3,background:'white'}}).webp({lossless:true}).toBuffer(),
 delivery:await sharp({create:{width:1200,height,channels:3,background:'white'}}).png().toBuffer()})));
function sample(contentId=id){
 const id=contentId;
 const data=['hero','social'].map((assetId,i)=>{
  const {source,delivery}=images[i]!,s=sha256(source),d=sha256(delivery),key='media/v1/objects/sha256/'+d.slice(0,2)+'/'+d+'.png';
  const canonicalSource={storageClass:'private_canonical_media_v1' as const,sha256:s,format:'webp' as const,width:1200,height:i?630:675,sizeBytes:source.length,ingestProfileId:'canonical',ingestProfileSha256:h};
  return {asset:{assetId,role:i?'social_card':'hero',origin:'deterministic_cover',status:'active',rightsRef:'rights',provenanceRef:'proof',visualAuditRef:'audit',defaultAlt:'Unit article image',canonicalSource,
   delivery:{mode:'fixed',profileId:'unit',profileSha256:h,master:{sha256:d,objectKey:key,format:'png',width:1200,height:i?630:675,sizeBytes:delivery.length},variants:[]}},
   mediaSource:{assetId,canonicalSha256:s,format:'webp',width:1200,height:i?630:675,ingestProfileId:'canonical',ingestProfileSha256:h,storageClass:'private_canonical_media_v1'},
   objects:[{plane:'source',key:'source/v1/objects/sha256/'+s.slice(0,2)+'/'+s+'.webp',sha256:s,sizeBytes:source.length,contentType:'image/webp',cacheControl:'private, no-store',base64:source.toString('base64')},
    {plane:'public',key,sha256:d,sizeBytes:delivery.length,contentType:'image/png',cacheControl:'public, max-age=31536000, immutable',base64:delivery.toString('base64')}]};
 });
 const mdx='---\n'+stringify({id,title:'Unit publication article',description:'Unit article description for validation.',category:'software',tags:[],pubDate:'2026-10-01',draft:true})+'---\n\nUnit article body.\n';
 const raw={protocol:'xpotato-ci-publication-package-v1',scope:'human_local',contentId:id,mdx,registry:{schemaVersion:1,contentId:id,assets:data.map(a=>a.asset)},
  rights:[{schemaVersion:1,rightsId:'rights',basis:'self_created',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-10-01T00:00:00Z'}],
  evidence:{jobId:'job-unit-publication',sourceBundleSha256:h,evidenceBundleSha256:h,citationCompilationSha256:h,technicalExampleVerificationSha256:h,contentAuditSha256:h,visualAuditSha256:h,externalAiPolicyId:'article-external-ai-disclosure-v1',externalAiPolicySha256:h},
  sourceRefs:[{sourceId:'source',sourceRecordSha256:h,kind:'url',canonicalUrl:'https://example.com/article',retrievedAt:'2026-10-01T00:00:00Z'}],
  materialClaims:[{claimId:'claim',statementSha256:sha256('Unit article body.'),locator:{blockIndex:0},claimType:'source_fact',evidence:[{evidenceId:'evidence',propositionSummary:'Unit claim',propositionSha256:h,interpretation:'explicit',sourceIds:['source'],freshnessChecked:true}]}],
  mediaSources:data.map(a=>a.mediaSource),aiRuns:[],variantManifests:data.map(a=>({assetId:a.asset.assetId,sha256:h})),objects:data.flatMap(a=>a.objects)} as unknown as Omit<CiPublicationPackage,'semanticSha256'>;
 const p=validateCiPublicationPackage({...raw,semanticSha256:publicationSemanticIdentity(raw)});
 const base:Record<string,string|null>={['apps/site/src/content/blog/00000000008008000000000001.mdx']:null};
 // The canonical Base32 route slug is derived by the implementation.
 for(const n of ['media','provenance','media-rights'])base['apps/site/src/content-registry/'+n+'/blog/'+id+'.json']=null;
 base['apps/site/src/content-registry/media/index.ts']='export const mediaRegistries = Object.freeze([]);\n';
 base['apps/site/src/content-registry/provenance/index.ts']='export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([]);\n';
 base['apps/site/src/content-registry/media-rights/index.ts']=null;
 const repo={commit,fingerprint:h,records:[],registrySnapshot:{},categories:[],tags:[],occupiedRoutes:[]} as DraftRepository;
 const context={repository:'Xpotato1024/xpotato-site',event:'workflow_dispatch',ref:'refs/heads/main',actor:'Xpotato1024',triggeringActor:'Xpotato1024',environment:'site-production',runId:'123',attempt:1,sourceSha:commit} as CiPublicationContext;
 const map=new Map<string,PublishObject>(),calls:string[]=[];
 const storage:PublicationStorage={configurationSha256:h,read:async o=>{calls.push('GET '+o.plane);const a=map.get(o.plane+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},
  putIfAbsent:vi.fn(async (o:PublishObject)=>{calls.push('PUT '+o.plane);map.set(o.plane+o.key,o);return 'uploaded' as const;}),readPublic:async o=>{const a=map.get('public'+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},close(){}};
 const packageSha256=sha256(canonicalJson(p)+'\n'),admission={protocol:'xpotato-reviewed-publication-admission-v1',contentId:id,
  producer:'verified-article-job-prepare-v1',packageSha256,semanticSha256:p.semanticSha256,evidence:p.evidence,aiRuns:p.aiRuns};
 return {p,repo,base,context,storage,map,calls,packageSha256,admission};
}
it('runs A then B then C, validates all actual bytes, and emits only canonical source/compact lineage/patch without applying it',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 const r=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-02T00:00:00Z')});
 expect(x.calls.filter(c=>c.startsWith('PUT'))).toEqual(['PUT source','PUT source','PUT public','PUT public','PUT protected','PUT protected']);
 expect(r).toMatchObject({storageVerified:true,canonicalFilesApplied:false,articleDeployed:false,publicationDay:'2026-11-02'});expect(r.protection.objects).toHaveLength(2);
 expect(r.provenance.materialClaims).toEqual(x.p.materialClaims);expect(r.changes).toHaveLength(7);expect(r.patch).toContain('pubDate: "2026-11-02"');
 expect(r.changes.find(c=>c.path==='apps/site/src/content-registry/media-rights/index.ts')).toMatchObject({before:null});
 expect(r.approval).toMatchObject({semanticSha256:x.p.semanticSha256,runId:'123',actor:'Xpotato1024'});expect(r.provenance.articleJob?.candidateSha256).toBe(x.p.semanticSha256);
});
it('preserves existing rights entries when adding a later new article',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 const path='apps/site/src/content-registry/media-rights/index.ts';
 x.base[path]='export const articleMediaRights = Object.freeze({"existing-article":[]});\n';
 const r=await publishCiPackage(x.p,{...x,mode:'publish'}),change=r.changes.find(c=>c.path===path)!;
 expect(change.before).toBe(x.base[path]);expect(change.after).toContain('"existing-article":[]');expect(change.after).toContain('"'+id+'":articleRights_');
});
it('rejects an incomplete rights-index snapshot before any storage',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 delete x.base['apps/site/src/content-registry/media-rights/index.ts'];
 await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('CI_PUBLICATION_BASE_REQUIRED');expect(x.calls).toEqual([]);
});
it('a failed or ambiguous B write stops C and produces no export',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 x.storage.putIfAbsent=vi.fn(async (o:PublishObject)=>{x.calls.push('PUT '+o.plane);if(o.plane==='public')throw Error('R2_PUT_UNKNOWN_NO_RETRY');x.map.set(o.plane+o.key,o);return 'uploaded' as const;});
 await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('NO_RETRY');expect(x.calls.some(c=>c==='PUT protected')).toBe(false);
});
it('verify-only reads without any PUT and rejects missing objects',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 await expect(publishCiPackage(x.p,{...x,mode:'verify-only'})).rejects.toThrow('R2_OBJECT_ABSENT');expect(x.storage.putIfAbsent).not.toHaveBeenCalled();
});
it('date-only changes preserve the semantic subject; body, rights, sources, canonical images and byte tampering do not',()=>{
 const {p}=sample(),date={...p,mdx:p.mdx.replace('2026-10-01','2026-11-02')};expect(publicationSemanticIdentity(date)).toBe(p.semanticSha256);
 const mdx=publicationMdx(p,new Date('2026-11-01T15:00:00Z'));
 expect(mdx).toContain('pubDate: "2026-11-02"');
 expect(parse(mdx.split('---')[1]!,{version:'1.1'}).pubDate).toBe('2026-11-02');
 const mutations:Array<(q:CiPublicationPackage)=>void>=[q=>q.mdx+='Changed.',q=>q.rights[0]!.publicationAuthorized=false,q=>q.materialClaims[0]!.evidence[0]!.sourceIds=['missing'],q=>q.objects[0]!.base64=Buffer.from('different').toString('base64')];
 for(const change of mutations){
  const q=structuredClone(p);change(q);expect(()=>validateCiPublicationPackage(q)).toThrow();
 }
 expect(()=>validateCiPublicationPackage({...p,scope:'synthetic_fixture'})).toThrow();
});
it('untrusted PR/fork/ref/actor/attempt and conflicting source bases fail before any storage',async()=>{
 for(const delta of [{event:'pull_request'},{repository:'other/repo'},{ref:'refs/heads/feature'},{actor:'other'},{attempt:2},{sourceSha:'c'.repeat(40)}]){
  const x=sample();await expect(publishCiPackage(x.p,{...x,context:{...x.context,...delta} as CiPublicationContext,mode:'publish'})).rejects.toThrow();expect(x.calls).toEqual([]);
 }
});
it('requires the reviewed main admission; self-rehashed input and missing or changed audit binding cannot authorize storage',async()=>{
 for(const value of [undefined,{}, {...sample().admission,packageSha256:'c'.repeat(64)}, {...sample().admission,evidence:{...sample().p.evidence,contentAuditSha256:'d'.repeat(64)}}]){
  const x=sample();await expect(publishCiPackage(x.p,{...x,admission:value,mode:'publish'})).rejects.toThrow();expect(x.calls).toEqual([]);
 }
 const x=sample(),changed={...x.p,mdx:x.p.mdx+'Changed.'};changed.semanticSha256=publicationSemanticIdentity(changed);
 await expect(publishCiPackage(changed,{...x,mode:'publish'})).rejects.toThrow('ADMISSION');expect(x.calls).toEqual([]);
});
it('rejects active MDX and actual malformed or dimension-mismatched images despite internally rehashed metadata',async()=>{
 const x=sample();const active={...x.p,mdx:x.p.mdx+'\n{process.env.SECRET}\n'};active.semanticSha256=publicationSemanticIdentity(active);
 expect(()=>validateCiPublicationPackage(active)).toThrow('SUBJECT');
 const changed=structuredClone(x.p);changed.registry.assets[0]!.canonicalSource!.width=1;changed.semanticSha256=publicationSemanticIdentity(changed);
 await expect(validateCiPublicationMedia(changed)).rejects.toThrow('PROFILE');
 const malformed=structuredClone(x.p);malformed.objects[0]!.base64=Buffer.from('not an image').toString('base64');
 await expect(validateCiPublicationMedia(malformed)).rejects.toThrow();
});
it('validates actual AVIF AV1 bytes using the decoder codec rather than a filename assertion',async()=>{
 const x=sample(),o=x.p.objects.find(o=>o.plane==='public')!,asset=x.p.registry.assets[0]!,bytes=await sharp(images[0]!.delivery).avif().toBuffer(),h=sha256(bytes),key='media/v1/objects/sha256/'+h.slice(0,2)+'/'+h+'.avif';
 Object.assign(o,{key,sha256:h,sizeBytes:bytes.length,contentType:'image/avif',base64:bytes.toString('base64')});
 Object.assign(asset.delivery.master,{objectKey:key,sha256:h,sizeBytes:bytes.length,format:'avif'});x.p.semanticSha256=publicationSemanticIdentity(x.p);
 await expect(validateCiPublicationMedia(validateCiPublicationPackage(x.p))).resolves.toBeUndefined();
});

// These are isolated synthetic public versions, not human audits or real storage receipts.
async function updateFixture(contentId=id){
 const id=contentId;
 const x=sample(id),slug=articleUrlId(id);x.base['apps/site/src/content/blog/'+slug+'.mdx']=null;
 const first=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-02T00:00:00Z')});
 const root=await mkdtemp(join(tmpdir(),'ci-update-'));
 const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const base=Object.fromEntries(first.changes.map(c=>[c.path,c.after]));
 for(const c of first.changes){await mkdir(dirname(join(root,c.path)),{recursive:true});await writeFile(join(root,c.path),c.after!);}
 git('init','--quiet');git('config','core.autocrlf','false');git('config','core.eol','lf');git('add','.');git('-c','user.name=Synthetic test','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Synthetic previous publication');
 const commit=git('rev-parse','HEAD'),contentPath=revisionPaths(id,slug).mdx;
 const repo:DraftRepository={...x.repo,commit,records:[{contentId:id,collection:'blog',slug,route:articleRoute(id),source:base[contentPath]!,sourceSha256:sha256(base[contentPath]!),registrySha256:h}],
  registrySnapshot:Object.fromEntries(Object.entries(base).filter(([p])=>p.startsWith('apps/site/src/content-registry/')).map(([p,t])=>[p,t!]))};
 const p=validateCiPublicationPackage({...x.p,mdx:base[contentPath]+'\nAn audited correction.\n',revision:preparePublicationRevision(repo,id,'correction'),
  semanticSha256:publicationSemanticIdentity({...x.p,mdx:base[contentPath]+'\nAn audited correction.\n',revision:preparePublicationRevision(repo,id,'correction')})});
 const packageSha256=sha256(canonicalJson(p)+'\n'),admission={...x.admission,packageSha256,semanticSha256:p.semanticSha256};
 x.calls.length=0;(x.storage.putIfAbsent as ReturnType<typeof vi.fn>).mockClear();
 return {...x,p,base,repo,context:{...x.context,sourceSha:commit},packageSha256,admission,repositoryRoot:root,root,git,first};
}
// Advance only after the last public byte readback. A second export-clock read
// jumps another day to detect inconsistent timestamps within one export.
function crossJstBoundary(x:ReturnType<typeof sample>,exportAt='2026-11-03T15:00:00.000Z'){
 const readPublic=x.storage.readPublic,expectedReads=x.p.objects.filter(o=>o.plane==='public').length*2;
 let reads=0,exportReads=0,complete=false;
 x.storage.readPublic=async o=>{const result=await readPublic(o);if(++reads===expectedReads)complete=true;return result;};
 return {now:()=>new Date(complete?(++exportReads===1?exportAt:'2026-11-04T15:00:00.000Z'):'2026-11-03T14:59:59.999Z'),
  observations:()=>({complete,reads,exportReads})};
}
it.each(['new','correction','metadata_only','media_only'] as const)('freezes one post-readback export instant across the JST boundary for %s',async kind=>{
 const update=kind==='new'?null:await updateFixture(),x=update??sample();
 try{
  if(kind!=='new'&&kind!=='correction'){
   const mdx=x.base[revisionPaths(id,articleUrlId(id)).mdx]!;
   x.p={...x.p,mdx,revision:{...x.p.revision!,kind}};x.p.semanticSha256=publicationSemanticIdentity(x.p);
   x.packageSha256=sha256(canonicalJson(x.p)+'\n');Object.assign(x.admission,{packageSha256:x.packageSha256,semanticSha256:x.p.semanticSha256});
  }
  const clock=crossJstBoundary(x),result=await publishCiPackage(x.p,{...x,mode:'publish',now:clock.now});
  const mdx=result.changes.find(c=>c.path===revisionPaths(id,articleUrlId(id)).mdx)!.after!,parsed=splitDraft(mdx);
  expect(parsed.frontmatter).toMatchObject({id,pubDate:kind==='new'?'2026-11-04':'2026-11-02',draft:false});
  expect(parsed.frontmatter.updatedDate).toBe(kind==='correction'?'2026-11-04':undefined);
  expect(parsed.body).toBe(splitDraft(x.p.mdx).body);
  expect(result).toMatchObject({semanticSha256:x.p.semanticSha256,publicationDay:'2026-11-04',storageVerified:true,canonicalFilesApplied:false,articleDeployed:false});
  expect(result.provenance.content).toMatchObject({route:articleRoute(id),mdxSha256:sha256(mdx)});
  expect(result.provenance.revision).toEqual(x.p.revision);
  expect(result.provenance.exportedAt).toBe('2026-11-03T15:00:00.000Z');
  expect(result.publication.completedAt).toBe(result.provenance.exportedAt);expect(result.protection.completedAt).toBe(result.provenance.exportedAt);
  expect(result.approval).toMatchObject({semanticSha256:x.p.semanticSha256,sourceSha:x.context.sourceSha});
  expect(clock.observations()).toEqual({complete:true,reads:x.p.objects.filter(o=>o.plane==='public').length*2,exportReads:1});
 }finally{if(update)await rm(update.root,{recursive:true,force:true});}
});
it.each(['metadata_only','media_only'] as const)('%s retains a prior update date across a later JST boundary',async kind=>{
 const x=await updateFixture();try{
  // Pure date-projection test; this modified prior date is not a storage receipt.
  const p={...x.p,revision:{...x.p.revision!,kind,previous:{...x.p.revision!.previous,updatedDate:'2026-11-03'}}};
  const fm=splitDraft(publicationMdx(p,new Date('2026-11-03T15:00:00.000Z'))).frontmatter;
  expect(fm).toMatchObject({id,pubDate:'2026-11-02',updatedDate:'2026-11-03'});
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('rechecks a backwards export clock after readback and emits no canonical export',async()=>{
 const x=await updateFixture();try{
  const clock=crossJstBoundary(x,'2020-01-01T00:00:00.000Z');
  await expect(publishCiPackage(x.p,{...x,mode:'publish',now:clock.now})).rejects.toThrow('CI_UPDATE_CLOCK_BEFORE_PUBLISHED_VERSION');
  expect(clock.observations()).toMatchObject({complete:true,exportReads:1});
  expect(x.calls.filter(c=>c.startsWith('PUT'))).toEqual(['PUT source','PUT source','PUT public','PUT public','PUT protected','PUT protected']);
  for(const c of x.first.changes)expect(await readFile(join(x.root,c.path),'utf8')).toBe(c.after);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('uses the same create/update publisher, binds actual Git preimages, retains prior objects and provides a guarded reversible patch',async()=>{
 const x=await updateFixture();try{
  const oldKeys=[...x.map.keys()];
  const result=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-03T00:00:00Z')});
  const mdx=result.changes.find(c=>c.path===revisionPaths(id,articleUrlId(id)).mdx)!.after!,fm=splitDraft(mdx).frontmatter;
  expect(fm).toMatchObject({id,pubDate:'2026-11-02',updatedDate:'2026-11-03',draft:false});
  expect(result.provenance.revision).toEqual(x.p.revision);expect(result.provenance.mediaRecovery).toBeDefined();
  expect(result.rollback?.previous.commit).toBe(x.repo.commit);expect(result.rollback?.patch).toContain('-An audited correction.');
  expect(result.changes.every(c=>c.before===x.base[c.path]&&c.after!==null)).toBe(true);
  expect(oldKeys.every(k=>x.map.has(k))).toBe(true);
  // Apply/undo only inside this fresh private fixture. Nothing touches the Site checkout.
  for(const c of result.changes)await writeFile(join(x.root,c.path),c.after!);
  const patch=join(x.root,'rollback.patch');await writeFile(patch,result.rollback!.patch);
  x.git('apply','--check',patch);x.git('apply',patch);
  for(const c of result.changes)expect(await readFile(join(x.root,c.path),'utf8')).toBe(c.before);
  for(const c of result.changes)await writeFile(join(x.root,c.path),c.after!);
  await writeFile(join(x.root,result.changes[0]!.path),'Concurrent edit');
  expect(()=>x.git('apply','--check',patch)).toThrow();
 }finally{await rm(x.root,{recursive:true,force:true});}
},30000);
it.each(['mdx','media','rights','provenance'] as const)('rejects a changed %s preimage before any storage access',async field=>{
 const x=await updateFixture();try{const path=revisionPaths(id,articleUrlId(id))[field];x.base[path]+=' ';await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow();expect(x.calls).toEqual([]);}finally{await rm(x.root,{recursive:true,force:true});}
});
it.each(['media','media-rights','provenance'])('rejects missing/malformed %s index before any storage access',async name=>{
 const x=await updateFixture();try{const path='apps/site/src/content-registry/'+name+'/index.ts';x.base[path]='export const wrong = [];';await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow();expect(x.calls).toEqual([]);}finally{await rm(x.root,{recursive:true,force:true});}
});
it('cannot rehash a different predecessor or use a nonancestor to borrow approval; verify-only sends no PUT',async()=>{
 const x=await updateFixture();try{
  for(const change of [(p:CiPublicationPackage)=>{p.revision!.previous.commit='f'.repeat(40)},(p:CiPublicationPackage)=>{p.revision!.previous.pubDate='2020-01-01'},(p:CiPublicationPackage)=>{p.revision!.previous.mediaRecoverySha256='e'.repeat(64)}]){
   const q=structuredClone(x.p);change(q);q.semanticSha256=publicationSemanticIdentity(q);
   await expect(publishCiPackage(q,{...x,mode:'publish'})).rejects.toThrow();expect(x.calls).toEqual([]);
  }
  const result=await publishCiPackage(x.p,{...x,mode:'verify-only',now:()=>new Date('2026-11-03T00:00:00Z')});
  expect(x.storage.putIfAbsent).not.toHaveBeenCalled();expect(result.storageVerified).toBe(true);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('an update unknown outcome emits no export or rollback and retains all old objects',async()=>{
 const x=await updateFixture();try{const keys=[...x.map.keys()];x.storage.putIfAbsent=vi.fn(async()=>{throw Error('R2_PUT_UNKNOWN_NO_RETRY');});
  await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('UNKNOWN_NO_RETRY');expect([...x.map.keys()]).toEqual(keys);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('refuses missing prior recovery and a detached index before storage, even when the current snapshot agrees',async()=>{
 const x=await updateFixture();try{
  const path=revisionPaths(id,articleUrlId(id)).provenance,old=JSON.parse(x.base[path]!);delete old.mediaRecovery;
  x.base[path]=canonicalJson(old)+'\n';(x.repo.registrySnapshot as Record<string,string>)[path]=x.base[path]!;
  await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('PUBLISHED_BASE');expect(x.calls).toEqual([]);
 }finally{await rm(x.root,{recursive:true,force:true});}
 const y=await updateFixture();try{
  const path='apps/site/src/content-registry/media/index.ts',old=y.base[path]!;
  y.base[path]=old.replace('contentMediaRegistrySchema.parse(articleMedia_'+id.replaceAll('-','_')+'),','');
  (y.repo.registrySnapshot as Record<string,string>)[path]=y.base[path]!;
  await expect(publishCiPackage(y.p,{...y,mode:'publish'})).rejects.toThrow('INDEX');expect(y.calls).toEqual([]);
 }finally{await rm(y.root,{recursive:true,force:true});}
});
it('protects changed image bytes under new immutable keys and retains every previous source/public/protected object',async()=>{
 const x=await updateFixture();try{
  const oldKeys=[...x.map.keys()],asset=x.p.registry.assets[0]!,oldSource=asset.canonicalSource!.sha256,oldPublic=asset.delivery.master.sha256;
  const source=await sharp({create:{width:1200,height:675,channels:3,background:'red'}}).webp({lossless:true}).toBuffer();
  const delivery=await sharp(source).png().toBuffer(),s=sha256(source),d=sha256(delivery),key='media/v1/objects/sha256/'+d.slice(0,2)+'/'+d+'.png';
  Object.assign(asset.canonicalSource!,{sha256:s,sizeBytes:source.length});Object.assign(asset.delivery.master,{sha256:d,sizeBytes:delivery.length,objectKey:key});
  Object.assign(x.p.mediaSources.find(r=>r.assetId===asset.assetId)!,{canonicalSha256:s});
  x.p.objects=x.p.objects.filter(o=>o.sha256!==oldSource&&o.sha256!==oldPublic);
  x.p.objects.push({plane:'source',key:'source/v1/objects/sha256/'+s.slice(0,2)+'/'+s+'.webp',sha256:s,sizeBytes:source.length,contentType:'image/webp',cacheControl:'private, no-store',base64:source.toString('base64')},
   {plane:'public',key,sha256:d,sizeBytes:delivery.length,contentType:'image/png',cacheControl:'public, max-age=31536000, immutable',base64:delivery.toString('base64')});
  x.p.semanticSha256=publicationSemanticIdentity(x.p);x.packageSha256=sha256(canonicalJson(x.p)+'\n');Object.assign(x.admission,{packageSha256:x.packageSha256,semanticSha256:x.p.semanticSha256});
  const result=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-03T00:00:00Z')});
  expect(x.map.get('protected'+key)?.bytes).toEqual(delivery);expect(oldKeys.every(k=>x.map.has(k))).toBe(true);
  expect(result.provenance.mediaRecovery?.objects.some(o=>o.sha256===d)).toBe(true);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('metadata/media updates preserve existing dates, while future/backwards clocks stop before storage',async()=>{
 const x=await updateFixture();try{
  const p={...x.p,mdx:x.base[revisionPaths(id,articleUrlId(id)).mdx]!,revision:{...x.p.revision!,kind:'media_only' as const}};p.semanticSha256=publicationSemanticIdentity(p);
  expect(splitDraft(publicationMdx(p,new Date('2026-11-03T00:00:00Z'))).frontmatter).toMatchObject({pubDate:'2026-11-02'});
  expect(splitDraft(publicationMdx(p,new Date('2026-11-03T00:00:00Z'))).frontmatter.updatedDate).toBeUndefined();
  await expect(publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2020-01-01T00:00:00Z')})).rejects.toThrow('CLOCK');expect(x.calls).toEqual([]);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it.each(['00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000022'])('creates and updates independent article %s without a first-article path',async contentId=>{
 const x=await updateFixture(contentId);try{
  const result=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-03T00:00:00Z')});
  expect(result.provenance.contentId).toBe(contentId);expect(result.provenance.content.route).toBe(articleRoute(contentId));
  expect(result.changes.find(c=>c.path===revisionPaths(contentId,articleUrlId(contentId)).mdx)?.after).toContain('An audited correction.');
 }finally{await rm(x.root,{recursive:true,force:true});}
});
it('checks the actual immutable Git ancestor even with a self-consistent reviewed package binding',async()=>{
 const x=await updateFixture();try{
  x.p.revision!.previous.commit='f'.repeat(40);x.p.semanticSha256=publicationSemanticIdentity(x.p);
  x.packageSha256=sha256(canonicalJson(x.p)+'\n');Object.assign(x.admission,{packageSha256:x.packageSha256,semanticSha256:x.p.semanticSha256});
  await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('CI_UPDATE_GIT_BASE_CONFLICT');expect(x.calls).toEqual([]);
 }finally{await rm(x.root,{recursive:true,force:true});}
});
// The independently tested Job/audit readers are replaced at their trusted
// boundary with explicitly synthetic snapshots. Package byte generation,
// image decoding, previous-Git binding and admission generation stay real.
it.each([false,true])('the same package producer prepares a new/update bundle (%s) from a verified snapshot',async update=>{
 const x=await updateFixture(),folder=await mkdtemp(join(tmpdir(),'ci-producer-'));
 try{
  const p=update?x.p:sample('00000000-0000-4000-8000-000000000033').p;
  const sourceObjects=p.objects.filter(o=>o.plane==='source'),publicObjects=p.objects.filter(o=>o.plane==='public');
  for(const [i,o]of p.objects.entries())await writeFile(join(folder,'image-'+i),Buffer.from(o.base64,'base64'));
  const location=(hash:string)=>'image-'+p.objects.findIndex(o=>o.sha256===hash);
  const material={frontmatter:splitDraft(p.mdx).frontmatter,route:articleRoute(p.contentId),mdx:p.mdx,redirects:[],
   storagePlan:{confirmed:true,sourceObjects:sourceObjects.map(o=>({...o,objectKey:o.key})),publicObjects:publicObjects.map(o=>({...o,objectKey:o.key}))},
   candidate:{evidence:p.evidence},provenanceProposal:{sourceRefs:p.sourceRefs,materialClaims:p.materialClaims,mediaSources:p.mediaSources,aiRuns:p.aiRuns}};
  const snapshot={folder,plan:{scope:'human_local',rights:p.rights},audit:{conclusion:'pass',syntheticTestOnly:true},
   c:{store:{jobId:p.evidence.jobId,...(update?{original:{sourceSha256:p.revision!.previous.mdxSha256,route:articleRoute(p.contentId)}}:{}),
    spec:{target:{updateKind:'correction'},permissions:{repositoryExport:true,privateCanonicalMediaStorage:true,publicMediaUpload:true,protectedMediaOperation:true}}},journal:{}},
   masters:{assets:p.registry.assets.map(a=>({ingest:{canonicalMaster:{sha256:a.canonicalSource!.sha256,privateRelativePath:location(a.canonicalSource!.sha256)}}}))},
   media:{registry:p.registry,localObjects:publicObjects.map(o=>({sha256:o.sha256,path:location(o.sha256)})),variants:p.variantManifests.map(v=>({assetId:v.assetId,manifestSha256:v.sha256}))}};
  vi.spyOn(visualSnapshot,'verifiedPublicationMediaSnapshot').mockResolvedValue(snapshot as never);
  vi.spyOn(candidateCompiler,'candidateMaterials').mockResolvedValue(material as never);
  vi.spyOn(journal,'loadReviewPayload').mockResolvedValue({conclusion:'pass',syntheticTestOnly:true} as never);
  const r=await prepareCiPublicationBundle('synthetic-job',update?x.repo:sample().repo,x.root);
  expect(r.package.revision?.previous.commit).toBe(update?x.repo.commit:undefined);
  expect(r.admission.packageSha256).toBe(sha256(r.bytes));expect(r.package.contentId).toBe(p.contentId);
  expect(r.package.objects).toHaveLength(p.objects.length);expect(r.package.objects).toEqual(expect.arrayContaining(p.objects));expect(r.package.semanticSha256).toBe(publicationSemanticIdentity(r.package));
  if(update){snapshot.c.store.original!.sourceSha256='0'.repeat(64);await expect(prepareCiPublicationBundle('synthetic-job',x.repo,x.root)).rejects.toThrow('CI_UPDATE_BASE_CONFLICT');}
  snapshot.plan.scope='synthetic_fixture';await expect(prepareCiPublicationBundle('synthetic-job',x.repo,x.root)).rejects.toThrow('AUDITS_REQUIRED');
 }finally{await rm(folder,{recursive:true,force:true});await rm(x.root,{recursive:true,force:true});}
});

it('preserves only explicit publication instants and binds them into approval identity',()=>{
 const {p}=sample(),parsed=splitDraft(p.mdx);
 const withFields=(fields:object)=>({...p,mdx:'---\n'+stringify({...parsed.frontmatter,pubDate:'2026-11-02',...fields},{compat:'yaml-1.1'})+'---\n'+parsed.body});
 const authored=withFields({publishedAt:'2026-11-02T00:00:00+09:00'}),now=new Date('2026-11-02T01:00:00+09:00');
 expect(splitDraft(publicationMdx(authored,now)).frontmatter.publishedAt).toBe('2026-11-02T00:00:00+09:00');
 expect(publicationSemanticIdentity(authored)).not.toBe(publicationSemanticIdentity(withFields({})));
 expect(()=>publicationMdx(withFields({publishedAt:'2026-11-01T00:00:00+09:00'}),now)).toThrow();
 expect(()=>publicationMdx(withFields({publishedAt:'2026-11-02T02:00:00+09:00'}),now)).toThrow('CI_PUBLICATION_INSTANT_IN_FUTURE');
 const previous={commit,fileSlug:articleUrlId(id),route:articleRoute(id),pubDate:'2026-11-02',publishedAt:'2026-11-02T00:00:00+09:00',updatedDate:'2026-11-02',updatedAt:'2026-11-02T00:30:00+09:00',mdxSha256:h,mediaSha256:h,rightsSha256:h,provenanceSha256:h,mediaRecoverySha256:h};
 const revision={...withFields({publishedAt:previous.publishedAt,updatedDate:previous.updatedDate,updatedAt:previous.updatedAt}),revision:{kind:'metadata_only' as const,previous}};
 expect(splitDraft(publicationMdx(revision,now)).frontmatter.updatedAt).toBe(previous.updatedAt);
 expect(()=>publicationMdx({...revision,mdx:revision.mdx.replace(previous.updatedAt,'2026-11-02T00:45:00+09:00')},now)).toThrow('CI_UPDATE_NON_MATERIAL_INSTANT_CHANGED');
 expect(()=>publicationMdx({...revision,mdx:revision.mdx.replace(previous.publishedAt,'2026-11-02T00:01:00+09:00')},now)).toThrow('CI_UPDATE_PUBLICATION_INSTANT_CHANGED');
});
