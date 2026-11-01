import {it,expect,vi} from 'vitest';import {stringify} from 'yaml';
import {publicationSemanticIdentity,validateCiPublicationPackage,publicationPackageObjects,type CiPublicationPackage} from './ci-publication-package.js';
import {publishCiPackage,publicationMdx,type CiPublicationContext} from './ci-publication.js';
import {sha256} from './canonical.js';import type {DraftRepository} from './draft-job.js';import type {PublicationStorage,PublishObject} from './r2-sdk-store.js';
const id='00000000-0000-4000-8000-000000000001',h='a'.repeat(64),commit='b'.repeat(40);
function sample(){
 const data=['hero','social'].map((assetId,i)=>{
  const source=Buffer.from(assetId+' original'),delivery=Buffer.from(assetId+' public'),s=sha256(source),d=sha256(delivery),key='media/v1/objects/sha256/'+d.slice(0,2)+'/'+d+'.png';
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
 base['apps/site/src/content-registry/media-rights/index.ts']='export const articleMediaRights = Object.freeze({});\n';
 const repo={commit,fingerprint:h,records:[],registrySnapshot:{},categories:[],tags:[],occupiedRoutes:[]} as DraftRepository;
 const context={repository:'Xpotato1024/xpotato-site',event:'workflow_dispatch',ref:'refs/heads/main',actor:'Xpotato1024',triggeringActor:'Xpotato1024',environment:'site-production',runId:'123',attempt:1,sourceSha:commit} as CiPublicationContext;
 const map=new Map<string,PublishObject>(),calls:string[]=[];
 const storage:PublicationStorage={configurationSha256:h,read:async o=>{calls.push('GET '+o.plane);const a=map.get(o.plane+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},
  putIfAbsent:vi.fn(async (o:PublishObject)=>{calls.push('PUT '+o.plane);map.set(o.plane+o.key,o);return 'uploaded' as const;}),readPublic:async o=>{const a=map.get('public'+o.key);return a?{status:'found',bytes:Buffer.from(a.bytes),contentType:a.contentType,cacheControl:a.cacheControl}:{status:'absent'};},close(){}};
 return {p,repo,base,context,storage,map,calls};
}
it('runs A then B then C, validates all actual bytes, and emits only canonical source/compact lineage/patch without applying it',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 const r=await publishCiPackage(x.p,{...x,mode:'publish',now:()=>new Date('2026-11-02T00:00:00Z')});
 expect(x.calls.filter(c=>c.startsWith('PUT'))).toEqual(['PUT source','PUT source','PUT public','PUT public','PUT protected','PUT protected']);
 expect(r).toMatchObject({storageVerified:true,canonicalFilesApplied:false,articleDeployed:false,publicationDay:'2026-11-02'});expect(r.protection.objects).toHaveLength(2);
 expect(r.provenance.materialClaims).toEqual(x.p.materialClaims);expect(r.changes).toHaveLength(7);expect(r.patch).toContain('pubDate: 2026-11-02');
 expect(r.approval).toMatchObject({semanticSha256:x.p.semanticSha256,runId:'123',actor:'Xpotato1024'});expect(r.provenance.articleJob?.candidateSha256).toBe(x.p.semanticSha256);
});
it('a failed or ambiguous B write stops C and produces no export',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 x.storage.putIfAbsent=vi.fn(async (o:PublishObject)=>{x.calls.push('PUT '+o.plane);if(o.plane==='public')throw Error('R2_PUT_UNKNOWN_NO_RETRY');x.map.set(o.plane+o.key,o);return 'uploaded' as const;});
 await expect(publishCiPackage(x.p,{...x,mode:'publish'})).rejects.toThrow('NO_RETRY');expect(x.calls.some(c=>c==='PUT protected')).toBe(false);
});
it('verify-only reads without any PUT and rejects missing objects',async()=>{
 const x=sample();const {articleUrlId}=await import('@xpotato/content-contracts');x.base['apps/site/src/content/blog/'+articleUrlId(id)+'.mdx']=null;
 await expect(publishCiPackage(x.p,{...x,mode:'verify-only'})).rejects.toThrow('MISMATCH');expect(x.storage.putIfAbsent).not.toHaveBeenCalled();
});
it('date-only changes preserve the semantic subject; body, rights, sources, canonical images and byte tampering do not',()=>{
 const {p}=sample(),date={...p,mdx:p.mdx.replace('2026-10-01','2026-11-02')};expect(publicationSemanticIdentity(date)).toBe(p.semanticSha256);
 expect(publicationMdx(p,new Date('2026-11-01T15:00:00Z'))).toContain('pubDate: 2026-11-02');
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
