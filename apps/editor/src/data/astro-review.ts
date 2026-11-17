import {unzipSync,strFromU8} from 'fflate';
import {validateReviewBundle,type EditorReviewBundle} from '@xpotato/editor-core/review';
import {parseDraft} from '@xpotato/editor-core/draft';
import {inspectImage} from '@xpotato/editor-core/image-inspection';
import type {LocalDraft,LocalMedia} from './storage.js';
import {request,query,EditorApiError} from './api.js';
import {hashBlob} from '../media/optimize.js';
export async function loadAstroReview(draft:LocalDraft):Promise<EditorReviewBundle>{
 if(!draft.syncedCommit||draft.syncedSource!==draft.source)throw Error('EDITOR_REVIEW_REQUIRES_SAVED_SOURCE');
 const contentId=parseDraft(draft.source).data.id,parameters=query({commit:draft.syncedCommit,contentId});
 const state=await request<{ready:boolean;status:string}>('/review'+parameters);if(!state.ready)throw Error('EDITOR_REVIEW_NOT_READY: '+state.status);
 const response=await fetch('/editor-api/review/archive'+parameters,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new EditorApiError('EDITOR_REVIEW_DOWNLOAD_FAILED',response.status);
 const reader=response.body?.getReader();if(!reader)throw Error('REVIEW_ARCHIVE_EMPTY');const pieces:Uint8Array[]=[];let bytes=0;
 try{while(true){const result=await reader.read();if(result.done)break;bytes+=result.value.length;if(bytes>24*1024*1024){await reader.cancel();throw Error('REVIEW_ARCHIVE_TOO_LARGE');}pieces.push(result.value);}}finally{reader.releaseLock();}
 const zipped=new Uint8Array(bytes);let offset=0;for(const piece of pieces){zipped.set(piece,offset);offset+=piece.length;}
 let accepted=false;const entries=unzipSync(zipped,{filter(file){if(file.name!=='review.json'||file.originalSize>24*1024*1024||file.originalSize<1)return false;if(accepted)throw Error('REVIEW_ARCHIVE_DUPLICATE');accepted=true;return true;}});
 const text=entries['review.json'];if(!text)throw Error('REVIEW_ARCHIVE_ENTRY_MISSING');
 const bundle=validateReviewBundle(JSON.parse(strFromU8(text)) as EditorReviewBundle,{commit:draft.syncedCommit,contentId,sourceSha256:await hashBlob(new Blob([draft.source]))});
 if(await hashBlob(new Blob([bundle.html]))!==bundle.htmlSha256)throw Error('REVIEW_HTML_HASH_MISMATCH');for(const style of bundle.styles)if(await hashBlob(new Blob([style.css]))!==style.sha256)throw Error('REVIEW_CSS_HASH_MISMATCH');return bundle;
}
export async function renderAstroReview(bundle:EditorReviewBundle,media:LocalMedia[]):Promise<{url:string;missing:string[];dispose:()=>void}>{
 if(/<style(?:\s|>)/iu.test(bundle.html)||/<[a-z][^>]*\sstyle\s*=/iu.test(bundle.html))throw Error('REVIEW_INLINE_STYLE_NOT_ALLOWED');
 const document=new DOMParser().parseFromString(bundle.html,'text/html'),urls:string[]=[],missing:string[]=[];
 try{
 for(const node of document.querySelectorAll('script,iframe,object,embed,base,form,link,meta[http-equiv]'))node.remove();
 for(const node of document.querySelectorAll('*'))for(const attribute of Array.from(node.attributes))if(/^on/iu.test(attribute.name))node.removeAttribute(attribute.name);
 for(const style of bundle.styles){if(await hashBlob(new Blob([style.css]))!==style.sha256)throw Error('REVIEW_CSS_HASH_MISMATCH');const value=URL.createObjectURL(new Blob([style.css],{type:'text/css'}));urls.push(value);const link=document.createElement('link');link.rel='stylesheet';link.href=value;document.head.append(link);}
 for(const image of document.querySelectorAll('img')){
  const assetId=image.getAttribute('data-editor-review-asset');
  if(assetId){const candidate=media.find(item=>item.assetId===assetId);if(!candidate){missing.push(assetId);image.removeAttribute('src');continue;}
   if(await hashBlob(candidate.blob)!==candidate.sha256)throw Error('LOCAL_MEDIA_HASH_MISMATCH');
   const actual=inspectImage(new Uint8Array(await candidate.blob.arrayBuffer()),candidate.kind);const src=URL.createObjectURL(candidate.blob);urls.push(src);image.src=src;image.width=actual.width;image.height=actual.height;image.setAttribute('data-editor-image-sha',candidate.sha256);image.parentElement?.querySelector('[data-editor-image-missing]')?.remove();
  }else if(!image.getAttribute('src')?.startsWith('data:image/'))image.removeAttribute('src');
  image.removeAttribute('srcset');
 }
 for(const node of document.querySelectorAll('a')){node.removeAttribute('href');node.removeAttribute('target');node.setAttribute('aria-disabled','true');}
 const policy=document.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; style-src blob:; font-src data:; img-src blob: data:; base-uri 'none'; form-action 'none'; object-src 'none'";document.head.prepend(policy);
 const noindex=document.createElement('meta');noindex.name='robots';noindex.content='noindex,nofollow';document.head.append(noindex);
 const url=URL.createObjectURL(new Blob(['<!doctype html>\n'+document.documentElement.outerHTML],{type:'text/html'}));urls.push(url);
 return {url,missing:[...new Set(missing)],dispose:()=>urls.forEach(value=>URL.revokeObjectURL(value))};
 }catch(error){urls.forEach(value=>URL.revokeObjectURL(value));throw error;}
}
