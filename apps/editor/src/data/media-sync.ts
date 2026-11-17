import {request,query,fetchPrivateMedia} from './api.js';
import {localMedia,saveLocalMedia,type LocalDraft,type LocalMedia} from './storage.js';
import {hashBlob} from '../media/optimize.js';
import {parseDraft} from '@xpotato/editor-core/draft';
import {assertMediaBudget,type MediaKind} from '@xpotato/editor-core/policy';
export interface RemoteDraft {id:string;contentId:string;branch:string;commit:string;revision:number;lastEditedAt:string;state:string;assets:Record<string,string>;holdUntil?:string;reviewUntil?:string}
export interface RemoteAsset {id:string;draftId:string;assetId:string;sha256:string;sourceSha256:string;bytes:number;sourceBytes:number;mime:string;kind:MediaKind;createdAt:string;status:'staged'|'rejected'|'deleting'|'promoted';transform:string;sourceRetained:boolean;width:number;height:number;frames:number;durationMs:number}
export interface RemoteMediaSnapshot {draft:RemoteDraft;assets:RemoteAsset[]}
export async function findMediaSnapshot(draft:LocalDraft):Promise<RemoteMediaSnapshot|null>{
 if(draft.remoteDraftId)return request('/draft'+query({id:draft.remoteDraftId}));
 const id=parseDraft(draft.source).data.id,branch=draft.workingBranch||draft.sourceBranch;
 const candidates=(await request<RemoteDraft[]>('/drafts')).filter(item=>item.contentId===id&&item.branch===branch&&item.state!=='deleted');
 if(candidates.length>1)throw Error('DRAFT_MEDIA_AMBIGUOUS');
 return candidates[0]?request('/draft'+query({id:candidates[0].id})):null;
}
export async function restoreMediaSnapshot(local:LocalDraft,remote:RemoteMediaSnapshot):Promise<{draft:LocalDraft;missing:string[]}>{
 if(remote.draft.contentId!==parseDraft(local.source).data.id||remote.draft.branch!==(local.workingBranch||local.sourceBranch))throw Error('DRAFT_MEDIA_IDENTITY_MISMATCH');
 const cached=await localMedia(local.id),missing:string[]=[];
 for(const [assetId,id] of Object.entries(remote.draft.assets)){
  const asset=remote.assets.find(item=>item.id===id&&item.assetId===assetId&&item.status==='staged');if(!asset){missing.push(assetId);continue;}
  const existing=cached.find(item=>item.assetId===assetId);
  if(existing&&!existing.remoteId&&existing.sha256!==asset.sha256){missing.push(assetId+'（端末内の変更と競合）');continue;}
  if(existing?.sha256===asset.sha256&&existing.remoteId===asset.id)continue;
  try{assertMediaBudget(asset.kind,asset.bytes);const blob=await fetchPrivateMedia(asset.id);if(blob.size!==asset.bytes||await hashBlob(blob)!==asset.sha256)throw Error('MEDIA_HASH_MISMATCH');
   await saveLocalMedia({id:existing?.id??crypto.randomUUID(),draftId:local.id,assetId,blob,originalBytes:asset.sourceBytes,sourceSha256:asset.sourceSha256,sha256:asset.sha256,kind:asset.kind,transform:asset.transform,createdAt:asset.createdAt,remoteId:asset.id,originalName:assetId,sourceRetained:asset.sourceRetained});
  }catch{missing.push(assetId);}
 }
 return {draft:{...local,remoteDraftId:remote.draft.id,remoteRevision:remote.draft.revision},missing};
}
