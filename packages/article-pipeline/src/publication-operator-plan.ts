import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import {sha256Schema} from '@xpotato/content-contracts';
import type {DraftRepository} from './draft-job.js';
import type {Plane} from './publication-contracts.js';
import type {MediaWriteObject,MediaWriteSessionDescriptor} from './media-write-runtime.js';
import {inspectMediaSessionRequest,type MediaSessionRequest} from './media-session-factory.js';
import {publicationCandidate,readPublicationHead} from './publication-approval.js';
import {candidateDirectory} from './candidate-review.js';
import {candidatePreviewSnapshot,previewClockGuard} from './candidate-freshness.js';
import {assertPublicationRights} from './publication-public-metadata.js';
import {assertPersistenceCapabilities} from './media-persistence.js';
import {fingerprint} from './canonical.js';
import {rememberApprovedOperation} from './operator-capability.js';

type StoragePlan={
 profile:unknown;confirmed:boolean;
 sourceObjects:readonly {objectKey:string;sha256:string;sizeBytes:number}[];
 publicObjects:readonly {objectKey:string;sha256:string;sizeBytes:number;contentType:string;cacheControl:string}[];
 protectedObjects:readonly {objectKey:string;sha256:string;sizeBytes:number}[];
};
const exact=(left:unknown,right:unknown)=>{if(fingerprint(left)!==fingerprint(right))throw Error('OPERATOR_PLAN_BINDING_MISMATCH');};
const sorted=<T extends {key:string}>(items:readonly T[])=>[...items].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);

/** Pure projection from the confirmed Site plan. No credential, callback, URL,
 * account locator or permission may be supplied by manuscript/frontmatter.
 * The protected factory receives B read-only objects plus C write objects.
 */
export function operatorMediaRequest(input:{plan:StoragePlan;plane:Plane;binding:MediaWriteSessionDescriptor['binding'];notAfter:string}):MediaSessionRequest{
 if(!['source','public','protected'].includes(input.plane))throw Error('OPERATOR_STAGE_INVALID');
 exact(input.plan.profile,articleMediaTargets);
 if(input.plan.confirmed!==true)throw Error('OPERATOR_CONFIRMED_STORAGE_PLAN_REQUIRED');
 const source:MediaWriteObject[]=input.plan.sourceObjects.map(o=>{
  const format=o.objectKey.split('.').at(-1);
  if(!['svg','webp'].includes(format??''))throw Error('OPERATOR_SOURCE_FORMAT_INVALID');
  return {plane:'source',key:o.objectKey,sha256:o.sha256,sizeBytes:o.sizeBytes,
   contentType:format==='svg'?'image/svg+xml':'image/webp',cacheControl:'private, no-store'};
 });
 const delivery:MediaWriteObject[]=input.plan.publicObjects.map(o=>({plane:'public',key:o.objectKey,sha256:o.sha256,
  sizeBytes:o.sizeBytes,contentType:o.contentType,cacheControl:o.cacheControl}));
 if(new Set(delivery.map(o=>o.key)).size!==delivery.length||new Set(source.map(o=>o.key)).size!==source.length)
  throw Error('OPERATOR_PHYSICAL_OBJECT_SET_INVALID');
 exact(sorted(input.plan.protectedObjects.map(o=>({key:o.objectKey,sha256:o.sha256,sizeBytes:o.sizeBytes}))),
  sorted(delivery.map(({key,sha256,sizeBytes})=>({key,sha256,sizeBytes}))));
 const protection:MediaWriteObject[]=delivery.map(o=>({...o,plane:'protected',cacheControl:'private, no-store'}));
 const objects=input.plane==='source'?source:input.plane==='public'?delivery:[...delivery,...protection];
 const identity={binding:input.binding,plane:input.plane,objects,notAfter:input.notAfter};
 return inspectMediaSessionRequest({schemaVersion:1,authorityRevision:articleMediaTargets.authority.revision,
  requestId:'publication-'+fingerprint(identity),binding:structuredClone(input.binding),objects,notAfter:input.notAfter});
}

/** Site half of a single owner-operated publication. This connects the Server
 * request validator and approval callback to actual current Site data. It does
 * not establish provider admission, issue credentials or promote a receipt.
 * No mutable JSON/fixture is accepted as a substitute for these functions.
 */
export async function prepareOneShotPublicationOperation(input:{directory:string;repo:DraftRepository;root:string;candidateSha256:string;policySha256:string;
 refreshRepository:()=>Promise<DraftRepository>}){
 const started=Date.now();sha256Schema.parse(input.policySha256);
 const repositoryBinding={commit:input.repo.commit,fingerprint:input.repo.fingerprint};
 const refresh=async()=>{
  const repo=await input.refreshRepository();exact({commit:repo.commit,fingerprint:repo.fingerprint},repositoryBinding);return repo;
 };
 await refresh();
 const current=await publicationCandidate(input.directory,input.repo,input.root,input.candidateSha256,'human');
 const head=await readPublicationHead(current),permissions=current.v.c.store.spec.permissions;
 if(!permissions.networkAccess||!permissions.repositoryExport)throw Error('OPERATOR_PUBLICATION_PERMISSION_REQUIRED');
 assertPersistenceCapabilities(permissions,current.v.media!.registry.assets.length);
 assertPublicationRights(current.v.plan!.rights);
 const plan=structuredClone(current.materials.storagePlan);
 if(!plan.confirmed)throw Error('OPERATOR_CONFIRMED_STORAGE_PLAN_REQUIRED');
 const approvalIdentity=(h:typeof head)=>({candidateSha256:h.candidateSha256,inputSha256:h.inputSha256,attemptId:h.attemptId,approvalSha256:h.approvalSha256,mode:h.mode});
 const headSha256=fingerprint(approvalIdentity(head)),binding={jobId:current.v.c.store.jobId,jobFingerprint:current.v.c.store.jobFingerprint,
  candidateSha256:input.candidateSha256,approvalSha256:head.approvalSha256,attemptId:current.v.c.binding.attemptId,
  inputSha256:current.v.c.binding.inputSha256,policySha256:input.policySha256};
 const folder=candidateDirectory(input.directory,input.candidateSha256);
 const snapshot=await candidatePreviewSnapshot(input.directory,input.root,binding.attemptId,folder,true);
 const clock=previewClockGuard(current.materials.frontmatter.pubDate,started,Date.now(),
  [current.materials.contentAudit,current.v.audit,current.v.plan!.visualInput],current.materials.timeZone);
 const fresh=async(signal?:AbortSignal)=>{
  signal?.throwIfAborted();clock();
  // Reloading the full candidate also checks the current Job/repository and
  // confirmed media plan. A saved approval file alone is not authorization.
  const checked=await publicationCandidate(input.directory,await refresh(),input.root,input.candidateSha256,'human');
  exact(fingerprint(approvalIdentity(await readPublicationHead(checked))),headSha256);
  exact(await candidatePreviewSnapshot(input.directory,input.root,binding.attemptId,folder,true),snapshot);
  signal?.throwIfAborted();clock();return checked;
 };
 return rememberApprovedOperation(Object.freeze({
  get binding(){return structuredClone(binding);},
  validateRequest:inspectMediaSessionRequest,
  readContext:fresh,
  async request(plane:Plane,notAfter:string,signal?:AbortSignal){
   await fresh(signal);
   return operatorMediaRequest({plan,plane,binding,notAfter});
  },
  async assertApproved(supplied:MediaWriteSessionDescriptor['binding'],plane:Plane,signal:AbortSignal){
   if(!['source','public','protected'].includes(plane))throw Error('OPERATOR_STAGE_INVALID');
   exact(supplied,binding);await fresh(signal);
  },
  preparationOnly:true as const,liveReady:false as const,formalStorageReceipt:false as const,productionEligible:false as const,
 }));
}
export type OneShotPublicationOperation=Awaited<ReturnType<typeof prepareOneShotPublicationOperation>>;
