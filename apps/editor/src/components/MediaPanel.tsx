import {findMediaSnapshot,restoreMediaSnapshot,type RemoteMediaSnapshot} from '../data/media-sync.js';
import {parseDraft} from '@xpotato/editor-core/draft';
import {useEffect,useState} from 'react';
import {mediaPolicy,type MediaKind} from '@xpotato/editor-core/policy';
import {optimizeImage} from '../media/optimize.js';
import {localMedia,saveLocalMedia,deleteLocalMedia,type LocalMedia,type LocalDraft} from '../data/storage.js';
import {request} from '../data/api.js';
interface Props {draft:LocalDraft;authenticated:boolean;onInsert:(assetId:string,alt:string)=>void;onDraft:(value:LocalDraft)=>void;onError:(message:string)=>void}
const format=(bytes:number)=>bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+' MiB':Math.round(bytes/1024)+' KiB';
function Thumbnail({media}:{media:LocalMedia}){const [url,setUrl]=useState('');useEffect(()=>{const value=URL.createObjectURL(media.blob);setUrl(value);return()=>URL.revokeObjectURL(value)},[media.blob]);return <img src={url} alt={media.assetId} loading="lazy"/>;}
export function MediaPanel({draft,authenticated,onInsert,onDraft,onError}:Props){
 const [items,setItems]=useState<LocalMedia[]>([]),[kind,setKind]=useState<MediaKind>('photo'),[busy,setBusy]=useState(false),[quota,setQuota]=useState<{used:number;reserved:number;limit:number}|null>(null),[remoteSnapshot,setRemoteSnapshot]=useState<RemoteMediaSnapshot|null>(null);
 const reload=()=>localMedia(draft.id).then(setItems);
 useEffect(()=>{void reload();},[draft.id]);
 async function add(files:FileList|null){if(!files?.length)return;setBusy(true);try{for(const file of Array.from(files)){const id='figure-'+crypto.randomUUID().slice(0,8);const media=await optimizeImage(file,draft.id,id,kind);await saveLocalMedia(media);}await reload();onError('');}catch(error){onError(error instanceof Error?error.message:'画像を処理できませんでした');}finally{setBusy(false);}}
 async function sync(media:LocalMedia){setBusy(true);try{
  if(!draft.workingBranch||!draft.baseCommit)throw Error('先に編集ブランチを作成して、記事をGitへ保存してください。');
  const remote=await request<{id:string;revision:number}>('/drafts',{method:'POST',body:{id:draft.remoteDraftId??draft.id,contentId:parseDraft(draft.source).data.id,branch:draft.workingBranch,commit:draft.baseCommit,sourcePath:draft.path}});
  const reservation=await request<{id:string}>('/media/reserve',{method:'POST',body:{draftId:remote.id,assetId:media.assetId,sha256:media.sha256,sourceSha256:media.sourceSha256,bytes:media.blob.size,sourceBytes:media.originalBytes,kind:media.kind,mime:media.blob.type,expectedDraftRevision:remote.revision,transform:media.transform,sourceRetained:media.sourceRetained}});
  const asset=await request<{id:string}>('/media/upload/'+reservation.id,{method:'PUT',blob:media.blob});await saveLocalMedia({...media,remoteId:asset.id});onDraft({...draft,remoteDraftId:remote.id,remoteRevision:remote.revision+1});setQuota(await request('/quota'));await reload();onError('');
 }catch(error){onError(error instanceof Error?error.message:'画像の同期に失敗しました');}finally{setBusy(false);}}
 async function restoreRemote(){setBusy(true);try{const remote=await findMediaSnapshot(draft);setRemoteSnapshot(remote);if(!remote){onError('このブランチには同期済みの画像がまだありません。');return;}const result=await restoreMediaSnapshot(draft,remote);onDraft(result.draft);await reload();setQuota(await request('/quota'));onError(result.missing.length?'画像を復元できませんでした: '+result.missing.join('、'):'');}catch(error){onError(error instanceof Error?error.message:'画像を取得できませんでした');}finally{setBusy(false);}}
 async function restoreRejected(id:string){setBusy(true);try{const remote=await findMediaSnapshot(draft);if(!remote)throw Error('DRAFT_NOT_FOUND');await request('/draft-state',{method:'POST',body:{id:remote.draft.id,revision:remote.draft.revision,action:'restore-media',mediaId:id}});await restoreRemote();}catch(error){onError(error instanceof Error?error.message:'復元できませんでした');}finally{setBusy(false);}}
 async function remove(media:LocalMedia){if(media.remoteId){try{const snapshot=await request<{draft:{revision:number}}>('/draft?id='+encodeURIComponent(draft.remoteDraftId??draft.id));await request('/draft-state',{method:'POST',body:{id:draft.remoteDraftId??draft.id,revision:snapshot.draft.revision,action:'reject',assetId:media.assetId}});}catch(error){onError(error instanceof Error?error.message:'棄却を同期できませんでした');return;}}await deleteLocalMedia(media.id);await reload();if(authenticated)setRemoteSnapshot(await findMediaSnapshot(draft));}
 return <section className="media-panel" aria-label="画像とGIF"><div className="section-title"><h2>画像とGIF</h2><span>{items.length}点</span></div><p className="muted">画像は先に端末内で処理します。同期先は非公開の下書き領域です。</p><button type="button" disabled={!authenticated||busy} onClick={()=>void restoreRemote()}>別の端末で同期した画像を取得</button>
  <label>画像の用途<select value={kind} onChange={event=>setKind(event.target.value as MediaKind)}><option value="photo">写真・説明用イラスト</option><option value="technical">技術図・画面・証拠画像</option><option value="animation">GIF・アニメーション</option></select></label>
  <label className="file-drop">画像を選択<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" disabled={busy} onChange={event=>void add(event.target.files)}/></label>
  <p className="muted small">入力24 MiBまで。保存上限は写真4 MiB、技術図・アニメーション8 MiB。GIFの動きは変更しません。</p>
  {busy&&<p role="status">画像を処理しています…</p>}
  {items.map(media=><article className="media-card" key={media.id}><Thumbnail media={media}/><div><strong>{media.assetId}</strong><p>{format(media.originalBytes)} → {format(media.blob.size)}</p><p className="muted small">{media.remoteId?'非公開R2に同期済み':'この端末のみ'} · {media.kind==='animation'?'動く画像':'静止画'}</p></div><div className="media-actions"><button type="button" onClick={()=>onInsert(media.assetId,'画像の説明')}>本文に挿入</button><button type="button" disabled={!authenticated||busy||Boolean(media.remoteId)} onClick={()=>void sync(media)}>画像を同期</button><button type="button" onClick={()=>void remove(media)}>棄却</button></div></article>)}
  {remoteSnapshot?.assets.some(item=>item.status==='rejected')&&<details><summary>棄却した画像を復元</summary>{remoteSnapshot.assets.filter(item=>item.status==='rejected').map(item=><p key={item.id}>{item.assetId} <button type="button" disabled={busy} onClick={()=>void restoreRejected(item.id)}>復元</button></p>)}</details>}
  {quota&&<p className="muted">下書き容量 {format(quota.used+quota.reserved)} / {format(quota.limit)}</p>}
 </section>;
}
