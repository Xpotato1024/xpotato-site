import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalSourceStorageReceiptSchema,mediaPublicationManifestSchema,mediaProtectionReceiptSchema} from '@xpotato/content-contracts';
import type {OneShotPublicationOperation} from './publication-operator-plan.js';
import type {Plane,ObjectRead} from './publication-contracts.js';
import type {ServerMediaSessionFactory} from './media-session-factory.js';
import {openOperatorMediaSession} from './media-session-factory.js';
import {createServerConditionalMediaWriter,storeMediaObjectWithJournal,mediaRuntimeLimits} from './media-write-runtime.js';
import {RuntimeOperationJournal} from './runtime-journal.js';
import {readPublicationHead} from './publication-approval.js';
import {publicationHeadSchema} from './publication-contracts.js';
import {candidateObjectPlan} from './publication-plan.js';
import {operatorReceiptSchema,validateOperatorReceipts} from './operator-receipts.js';
import {isApprovedOperation} from './operator-capability.js';
import {fingerprint,sha256,canonicalJson} from './canonical.js';
import {noLinks,immutable,atomic,locked} from './private-files.js';
import type {MediaReadbackPort} from './media-readback.js';

export type OneShotServerBindings={factories:Readonly<Record<Plane,ServerMediaSessionFactory>>;fetcher:typeof fetch;
 readPublic:(key:string,maxBytes:number,signal?:AbortSignal)=>Promise<ObjectRead>};
const roleFor=(plane:Plane)=>plane==='source'?'sources':plane==='public'?'publication':'protection';
/** Trusted executable Server factories, never callbacks/locators from JSON.
 * A native request is possible only after the real candidate + saved owner
 * approval, permission, exact key, fresh policy and Server grant checks pass.
 * This function does not issue parents or authorize any provider operation.
 */
export async function persistOneShotOperatorStage(operation:OneShotPublicationOperation,plane:Plane,bindings:OneShotServerBindings,signal?:AbortSignal){
 if(!isApprovedOperation(operation))throw Error('OPERATOR_APPROVED_EXECUTABLE_HANDLE_REQUIRED');
 const initial=await operation.readContext(signal);
 return locked(initial.directory,async()=>{
  const c=await operation.readContext(signal),head=await readPublicationHead(c),receipts=await validateOperatorReceipts(c,head);
  const role=roleFor(plane),prior={source:'HUMAN_APPROVED',public:'MEDIA_SOURCE_STORED',protected:'MEDIA_PUBLISHED'}[plane];
  if(!head[role]&&head.state!==prior)throw Error('OPERATOR_STAGE_ORDER_REQUIRED');
  const session=await openOperatorMediaSession({operation,plane,notAfter:new Date(Date.now()+900000).toISOString(),factory:bindings.factories[plane],...(signal?{signal}:{})});
  const writer=createServerConditionalMediaWriter({session,fetcher:bindings.fetcher,mode:'operator_runtime'});
  const plan=await candidateObjectPlan(c,operation.binding.policySha256,(key,hash)=>'site-protected-v1:sha256:'+hash+':'+key.split('.').at(-1));
  if(head[role]){
   for(const key of plan[plane].keys())await writer.verifyStored(plane,key,signal);
   await operation.readContext(signal);
   return {state:head.state,reused:true,formalStorageReceipt:true,productionEligible:false as const};
  }
  const journal=new RuntimeOperationJournal(join(c.folder,'runtime'),{jobId:operation.binding.jobId,jobFingerprint:operation.binding.jobFingerprint},mediaRuntimeLimits);
  const outcomes=new Map<string,{action:'uploaded'|'reused';verifiedAt:string}>(),operations=[];
  for(const [key,object] of plan[plane]){
   const result=await storeMediaObjectWithJournal({writer,journal,plane,key,bytes:object.bytes,...(signal?{signal}:{})});
   // Pending/unknown is retained. Restart cannot repeat it. A negative read
   // does not prove an earlier PUT has stopped; no automatic resend path.
   if(result.state!=='verified'||!result.outcome||!result.outputSha256||result.scope!=='operator_runtime')throw Error('OPERATOR_WRITE_UNKNOWN_NO_RESEND');
   outcomes.set(key,{action:result.outcome.action,verifiedAt:result.outcome.verifiedAt});
   operations.push({key,outputSha256:result.outputSha256,resultSha256:result.resultSha256});
  }
  const assets=c.v.media!.registry.assets,time=new Date().toISOString();let record:unknown;
  if(plane==='source')record=assets.map(a=>{
   const s=a.canonicalSource!,key='source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format,outcome=outcomes.get(key)!;
   const value={schemaVersion:1,candidateSha256:c.target,contentId:c.materials.frontmatter.id,assetId:a.assetId,canonicalSha256:s.sha256,
    storageClass:s.storageClass,action:outcome.action,verifiedSizeBytes:s.sizeBytes,storedAt:outcome.verifiedAt};
   return canonicalSourceStorageReceiptSchema.parse({...value,receiptSha256:fingerprint(value)});
  });
  else if(plane==='public'){
   const value={schemaVersion:1,authorization:{kind:'article_job',jobId:c.v.c.store.jobId,candidateSha256:c.target,
    humanApprovalRecordSha256:head.approvalSha256,canonicalSourceStorageReceiptSetSha256:fingerprint(receipts.sources),articleJobPublicMediaPermission:true},
    mediaSets:assets.map(a=>({assetId:a.assetId,rightsRef:a.rightsRef,variantManifestSha256:c.v.media!.variants.find(v=>v.assetId===a.assetId)!.manifestSha256,
     objects:[a.delivery.master,...a.delivery.variants].map((o,i)=>({purpose:i?'variant':'master',sha256:o.sha256,objectKey:o.objectKey,format:o.format,
      ...(i&&o.width?{width:o.width}:{}),contentType:o.format==='svg'?'image/svg+xml':'image/'+o.format,cacheControl:c.materials.storagePlan.profile.public.cacheControl,
      verifiedSizeBytes:o.sizeBytes,...outcomes.get(o.objectKey)}))})),completedAt:time};
   record=mediaPublicationManifestSchema.parse({...value,manifestSha256:fingerprint(value)});
  }else{
   const value={schemaVersion:1,candidateSha256:c.target,approvalRecordSha256:head.approvalSha256,mediaPublicationManifestSha256:receipts.publication!.manifestSha256,
    protectionClass:'cloudflare_protected_copy_v1',policyFingerprint:operation.binding.policySha256,
    objects:[...plan.protected].map(([key,o])=>({sha256:sha256(o.bytes),
     sourceObjectKey:key,verifiedSizeBytes:o.bytes.length,protectedObjectRef:o.protectedRef!,protectedAt:outcomes.get(key)!.verifiedAt})),completedAt:time};
   record=mediaProtectionReceiptSchema.parse({...value,receiptSha256:fingerprint(value)});
  }
  const envelope=operatorReceiptSchema.parse({protocol:'xpotato-operator-receipt-v1',mode:'operator_runtime',candidateSha256:c.target,
   approvalSha256:head.approvalSha256,role,policySha256:operation.binding.policySha256,operations,record});
  const pointer=fingerprint(envelope),artifacts=join(c.folder,'artifacts');await noLinks(artifacts);await mkdir(artifacts,{recursive:true,mode:0o700});
  await immutable(join(artifacts,pointer+'.json'),canonicalJson(envelope)+'\n');
  const next=publicationHeadSchema.parse({...head,[role]:pointer,state:{source:'MEDIA_SOURCE_STORED',public:'MEDIA_PUBLISHED',protected:'MEDIA_PROTECTED'}[plane]});
  await validateOperatorReceipts(c,next);
  for(const key of plan[plane].keys())await writer.verifyStored(plane,key,signal);
  if(plane==='public')for(const [key,expected] of plan.public){
   const actual=await bindings.readPublic(key,expected.bytes.length+1,signal);
   if(actual.status!=='found'||fingerprint(actual.object)!==fingerprint(expected))throw Error('OPERATOR_PUBLIC_DELIVERY_READBACK_REQUIRED');
  }
  const fresh=await operation.readContext(signal);
  if(fingerprint(await readPublicationHead(fresh))!==fingerprint(head))throw Error('OPERATOR_HEAD_CHANGED');
  await atomic(join(c.folder,'head.json'),canonicalJson(next)+'\n');
  return {state:next.state,reused:false,formalStorageReceipt:true,productionEligible:false as const};
 });
}

/** Read-only full-chain verifier transport, obtained from exact admitted stage
 * sessions. No input `mode:live` flag can replace opening these sessions. */
export async function operatorPublicationReadback(operation:OneShotPublicationOperation,bindings:OneShotServerBindings,signal?:AbortSignal):Promise<MediaReadbackPort>{
 if(!isApprovedOperation(operation))throw Error('OPERATOR_APPROVED_EXECUTABLE_HANDLE_REQUIRED');
 const sessions={} as Record<Plane,Awaited<ReturnType<typeof openOperatorMediaSession>>>;
 for(const plane of ['source','public','protected'] as const)sessions[plane]=await openOperatorMediaSession({operation,plane,
  notAfter:new Date(Date.now()+900000).toISOString(),factory:bindings.factories[plane],...(signal?{signal}:{})});
 return Object.freeze({mode:'live' as const,policy:(active?:AbortSignal)=>sessions.protected.policy(active),
  async read(plane:Plane,key:string,maxBytes:number,active?:AbortSignal){
   await operation.assertApproved(operation.binding,plane,active??new AbortController().signal);
   const privateRead=await sessions[plane].inspect(plane,key,maxBytes,active??new AbortController().signal);
   if(plane!=='public')return privateRead;
   const delivered=await bindings.readPublic(key,maxBytes,active);
   if(privateRead.status!=='found'||delivered.status!=='found'||fingerprint(privateRead.object)!==fingerprint(delivered.object))throw Error('OPERATOR_PUBLIC_DELIVERY_READBACK_REQUIRED');
   return delivered;
  }});
}
