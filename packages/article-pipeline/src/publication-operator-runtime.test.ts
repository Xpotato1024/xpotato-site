import {it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {articleRoute} from '@xpotato/content-contracts';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
const admission=vi.hoisted(()=>({candidate:vi.fn(),snapshot:vi.fn()}));
// Dummy candidate-admission boundary only. There is no actual article,
// actual owner decision, credential, network request or live provider in this test.
vi.mock('./publication-approval.js',async original=>({...await original<object>(),publicationCandidate:admission.candidate}));
vi.mock('./candidate-freshness.js',async original=>({...await original<object>(),candidatePreviewSnapshot:admission.snapshot}));
import {prepareOneShotPublicationOperation} from './publication-operator-plan.js';
import {persistOneShotOperatorStage,type OneShotServerBindings} from './publication-operator-runtime.js';
import {exportOneShotOperatorCandidate,verifyOperatorExport} from './publication-operator-export.js';
import {createOneShotSiteOperatorBinding} from './one-shot-operator-binding.js';
import {readPublicationHead} from './publication-approval.js';
import {validateOperatorReceipts} from './operator-receipts.js';
import {fingerprint,sha256,canonicalJson} from './canonical.js';
import type {Plane,StoredObject,ObjectRead} from './publication-contracts.js';
import type {MediaSessionRequest} from './media-session-factory.js';
const roots:string[]=[];afterEach(async()=>{vi.resetAllMocks();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'operator-unit-'));roots.push(root);
 const directory=join(root,'private-job'),folder=join(directory,'publication/human'),vfolder=join(directory,'visual');
 for(const p of [folder,vfolder,join(root,'apps/site/src/content-registry/media'),join(root,'apps/site/src/content-registry/provenance')])await mkdir(p,{recursive:true});
 execFileSync('git',['init','--quiet','--initial-branch=unit-fixture'],{cwd:root,windowsHide:true});
 const h='a'.repeat(64),policy='b'.repeat(64),id='00000000-0000-4000-8000-000000000001',route=articleRoute(id),source=Buffer.from('unit canonical'),delivery=Buffer.from('unit delivered');
 const s=sha256(source),d=sha256(delivery),skey='source/v1/objects/sha256/'+s.slice(0,2)+'/'+s+'.webp',key='media/v1/objects/sha256/'+d.slice(0,2)+'/'+d+'.png';
 await writeFile(join(vfolder,'source.webp'),source);await writeFile(join(vfolder,'delivery.png'),delivery);
 const asset={assetId:'card',role:'social_card',origin:'deterministic_cover',status:'active',rightsRef:'rights',provenanceRef:'proof',visualAuditRef:'audit',defaultAlt:'合成試験',
  canonicalSource:{storageClass:'private_canonical_media_v1',sha256:s,format:'webp',width:1200,height:630,sizeBytes:source.length,ingestProfileId:'canonical',ingestProfileSha256:h},
  delivery:{mode:'fixed',master:{sha256:d,objectKey:key,format:'png',width:1200,height:630,sizeBytes:delivery.length},variants:[]}};
 const registry={schemaVersion:1,contentId:id,assets:[asset]},rights=[{schemaVersion:1,rightsId:'rights',basis:'self_created',publicationAuthorized:true,confirmedBy:'user',confirmedAt:'2026-10-01T00:00:00Z'}];
 const decision={schemaVersion:1,candidateSha256:h,contentId:id,approvedAt:'2026-10-01T00:00:00Z',reviewer:'synthetic-unit-fixture',basis:'Unit data only; not a real owner approval',confirmed:true};
 const head={protocol:'xpotato-private-publication-v1',mode:'human',candidateSha256:h,inputSha256:h,attemptId:'attempt-unit',approvalSha256:fingerprint(decision),state:'HUMAN_APPROVED',sources:null,publication:null,protection:null,export:null,productionEligible:false};
 await writeFile(join(folder,'approval.json'),canonicalJson(decision));await writeFile(join(folder,'head.json'),canonicalJson(head));
 const index={media:'export const mediaRegistries = Object.freeze([]);\n',provenance:'export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([]);\n'};
 const registrySnapshot={'apps/site/src/content-registry/media/index.ts':index.media,'apps/site/src/content-registry/provenance/index.ts':index.provenance};
 for(const [p,text] of Object.entries(registrySnapshot))await writeFile(join(root,p),text);
 const repo={commit:'a'.repeat(40),fingerprint:h,records:[],registrySnapshot};
 const mediaSources=[{assetId:'card',canonicalSha256:s,format:'webp',width:1200,height:630,ingestProfileId:'canonical',ingestProfileSha256:h,storageClass:'private_canonical_media_v1'}];
 const mdx='---\nid: '+id+'\ntitle: 合成試験\n---\n合成本文。\n';
 const c:any={directory,root,target:h,mode:'human',folder,artifact:{scope:'human_local',reference:false,candidate:{evidence:{sourceBundleSha256:h,evidenceBundleSha256:h,citationCompilationSha256:h,technicalExampleVerificationSha256:h,contentAuditSha256:h},visual:{visualAuditManifestSha256:h}}},
  v:{repo,folder:vfolder,c:{store:{jobId:'job-unit',jobFingerprint:h,baseCommit:repo.commit,repositoryFingerprint:h,spec:{permissions:{networkAccess:true,repositoryExport:true,privateCanonicalMediaStorage:true,publicMediaUpload:true,protectedMediaOperation:true}}},binding:{attemptId:'attempt-unit',inputSha256:h}},audit:{},
   plan:{rights,visualInput:{}},masters:{assets:[{ingest:{canonicalMaster:{sha256:s,format:'webp',privateRelativePath:'source.webp'}}}]},media:{registry,variants:[{assetId:'card',manifestSha256:h}],localObjects:[{sha256:d,path:'delivery.png',contentType:'image/png'}]}},
  materials:{mdx,route,redirects:[],frontmatter:{id,pubDate:'2020-01-01'},timeZone:'Asia/Tokyo',contentAudit:{},plannedSeo:{},provenanceProposal:{content:{mdxSha256:sha256(mdx),frontmatterSha256:h,route},sourceRefs:[],materialClaims:[],mediaSources,aiRuns:[]},
   storagePlan:{profile:articleMediaTargets,confirmed:true,sourceObjects:[{objectKey:skey,sha256:s,sizeBytes:source.length}],publicObjects:[{objectKey:key,sha256:d,sizeBytes:delivery.length,contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl}],protectedObjects:[{objectKey:key,sha256:d,sizeBytes:delivery.length}]}}};
 admission.candidate.mockResolvedValue(c);admission.snapshot.mockResolvedValue(h);
 const operation=await prepareOneShotPublicationOperation({directory,root,repo:repo as never,candidateSha256:h,policySha256:policy,refreshRepository:async()=>repo as never});
 const stored=new Map<string,StoredObject>(),policyRead=async()=>({status:'found' as const,authorityRevision:articleMediaTargets.authority.revision,observedAt:new Date().toISOString(),fingerprint:policy,sourcePrivate:true,protectedPrivate:true,protectedIndefiniteLock:true,automaticExpiration:false,writersSeparated:true});
 const objects=(plane:Plane)=>c.materials.storagePlan[plane==='source'?'sourceObjects':plane==='public'?'publicObjects':'protectedObjects'];
 const factories={} as OneShotServerBindings['factories'];
 for(const stage of ['source','public','protected'] as const)(factories as any)[stage]={open:async(request:MediaSessionRequest)=>({descriptor:(({requestId,notAfter,...rest})=>({...rest,sessionId:requestId,expiresAt:notAfter}))(request),privateOrigins:['https://unit.r2.cloudflarestorage.com'],assertApproved:operation.assertApproved,policy:policyRead,
  inspect:async(plane:Plane,k:string):Promise<ObjectRead>=>{const o=stored.get(plane+':'+k);return o?{status:'found',object:{...o,bytes:Buffer.from(o.bytes)}}:{status:'absent',authoritative:true};},
  authorizePut:async(plane:Plane,k:string)=>({plane,key:k,method:'PUT' as const,url:'https://unit.r2.cloudflarestorage.com/'+plane+'/'+k,headers:{'if-none-match':'*','content-type':plane==='source'?'image/webp':'image/png','cache-control':plane==='public'?articleMediaTargets.public.cacheControl:'private, no-store'}})})};
 const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
  const u=new URL(String(url)),parts=u.pathname.slice(1).split('/'),plane=parts.shift() as Plane,k=parts.join('/');
  expect(objects(plane).some((o:any)=>o.objectKey===k)).toBe(true);const headers=new Headers(init?.headers),bytes=Buffer.from(init!.body as ArrayBuffer);
  stored.set(plane+':'+k,{bytes,contentType:headers.get('content-type')!,cacheControl:headers.get('cache-control')!,policySha256:policy,protectedRef:plane==='protected'?'site-protected-v1:sha256:'+sha256(bytes)+':png':null});
  return new Response(null,{status:201});
 });
 const readPublic=vi.fn(async(k:string):Promise<ObjectRead>=>{const o=stored.get('public:'+k);return o?{status:'found',object:{...o,bytes:Buffer.from(o.bytes)}}:{status:'unknown'};});
 return {root,directory,folder,c,operation,stored,key,fetcher,readPublic,bindings:{factories,fetcher:fetcher as typeof fetch,readPublic}};
}
it('exercises A then B then C, persisted receipt readback and private exact export using only inert local data',async()=>{
 const x=await fixture();
 await expect(persistOneShotOperatorStage(x.operation,'public',x.bindings)).rejects.toThrow('STAGE_ORDER');expect(x.fetcher).not.toHaveBeenCalled();
 for(const [plane,state] of [['source','MEDIA_SOURCE_STORED'],['public','MEDIA_PUBLISHED'],['protected','MEDIA_PROTECTED']] as const)
  expect(await persistOneShotOperatorStage(x.operation,plane,x.bindings)).toMatchObject({state,formalStorageReceipt:true,productionEligible:false});
 expect(x.fetcher).toHaveBeenCalledTimes(3);expect((await validateOperatorReceipts(x.c,await readPublicationHead(x.c))).protection).not.toBeNull();
 const bridge=createOneShotSiteOperatorBinding(x.operation,{kind:'isolated-child-put-v1',fetcher:x.bindings.fetcher},x.bindings.readPublic);
 const exported=await bridge.run({stages:{source:{factory:x.bindings.factories.source},public:{factory:x.bindings.factories.public},protected:{factory:x.bindings.factories.protected}}});
 expect(exported).toMatchObject({state:'EXPORTED',productionEligible:false});
 const manifest=await verifyOperatorExport(exported.output,exported.exportSha256);expect(manifest.changes).toHaveLength(7);
 expect(manifest.changes.find((v:any)=>v.path.endsWith('/media/index.ts')).after).not.toContain('.record');
 expect(privateDraftOutputErrors('public.json',JSON.stringify(manifest))).not.toHaveLength(0);
 await expect(readFile(join(x.root,manifest.files.find((v:any)=>v.path.endsWith('.mdx')).path))).rejects.toThrow();
 expect(await readFile(join(x.root,'apps/site/src/content-registry/media/index.ts'),'utf8')).toBe('export const mediaRegistries = Object.freeze([]);\n');
 expect((await exportOneShotOperatorCandidate(x.operation,x.bindings)).reused).toBe(true);expect(x.fetcher).toHaveBeenCalledTimes(3);
});
it('preserves unknown PUT and refuses restart resend or promotion into a source receipt',async()=>{
 const x=await fixture();x.fetcher.mockRejectedValue(Error('inert lost response'));
 await expect(persistOneShotOperatorStage(x.operation,'source',x.bindings)).rejects.toThrow('UNKNOWN_NO_RESEND');
 await expect(persistOneShotOperatorStage(x.operation,'source',x.bindings)).rejects.toThrow('NO_RESEND');expect(x.fetcher).toHaveBeenCalledTimes(1);
 expect((await readPublicationHead(x.c)).state).toBe('HUMAN_APPROVED');
});
it('refuses a JSON-shaped operation and changed object bytes before export',async()=>{
 const x=await fixture();await expect(persistOneShotOperatorStage({...x.operation},'source',x.bindings)).rejects.toThrow('EXECUTABLE_HANDLE');
 expect(()=>createOneShotSiteOperatorBinding(x.operation,{kind:'fixture-child-put-v1',fetcher:x.bindings.fetcher} as never,x.bindings.readPublic)).toThrow('ISOLATED_PUT_TRANSPORT');
 for(const plane of ['source','public','protected'] as const)await persistOneShotOperatorStage(x.operation,plane,x.bindings);
 x.stored.get('protected:'+x.key)!.bytes=Buffer.from('different');
 await expect(exportOneShotOperatorCandidate(x.operation,x.bindings)).rejects.toThrow('READBACK_MISMATCH');
 expect((await readPublicationHead(x.c)).state).toBe('MEDIA_PROTECTED');
});
it('does not certify public delivery from private S3 success when the public origin is unavailable or different',async()=>{
 const x=await fixture();await persistOneShotOperatorStage(x.operation,'source',x.bindings);
 x.readPublic.mockResolvedValueOnce({status:'unknown'});
 await expect(persistOneShotOperatorStage(x.operation,'public',x.bindings)).rejects.toThrow('PUBLIC_DELIVERY_READBACK');
 expect((await readPublicationHead(x.c)).state).toBe('MEDIA_SOURCE_STORED');
 await persistOneShotOperatorStage(x.operation,'public',x.bindings);await persistOneShotOperatorStage(x.operation,'protected',x.bindings);
 x.readPublic.mockResolvedValueOnce({status:'found',object:{...x.stored.get('public:'+x.key)!,bytes:Buffer.from('wrong public domain bytes')}});
 await expect(exportOneShotOperatorCandidate(x.operation,x.bindings)).rejects.toThrow('PUBLIC_DELIVERY_READBACK');
 expect((await readPublicationHead(x.c)).state).toBe('MEDIA_PROTECTED');expect(x.fetcher).toHaveBeenCalledTimes(3);
});
