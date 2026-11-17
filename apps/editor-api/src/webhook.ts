import {limitedRequestBytes} from './request-body.js';
import {DraftStore} from './state.js';
import {APIError,type Environment} from './types.js';
import {draftPath} from '@xpotato/editor-core/draft';
interface PushEvent {ref?:string;after?:string;deleted?:boolean;repository?:{full_name?:string};commits?:{added?:string[];modified?:string[];removed?:string[]}[]}
/** No Git/R2 credentials or article bytes leave the draft boundary. */
export async function acceptGitHubActivity(request:Request,env:Environment,now=Date.now()):Promise<Response>{
 if(!env.GITHUB_WEBHOOK_SECRET||!env.DRAFT_MEDIA)throw new APIError('ACTIVITY_SYNC_NOT_CONFIGURED',503);
 const signature=request.headers.get('X-Hub-Signature-256');
 if(!signature||!/^sha256=[a-f0-9]{64}$/u.test(signature))throw new APIError('WEBHOOK_SIGNATURE_INVALID',403);
 const bytes=await limitedRequestBytes(request,1024*1024),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const rawSignature=Uint8Array.from(signature.slice(7).match(/../gu)!.map(value=>parseInt(value,16)));
 if(!await crypto.subtle.verify('HMAC',key,rawSignature,bytes.buffer as ArrayBuffer))throw new APIError('WEBHOOK_SIGNATURE_INVALID',403);
 if(request.headers.get('X-GitHub-Event')!=='push')return new Response(null,{status:204});
 let event:PushEvent;try{event=JSON.parse(new TextDecoder().decode(bytes)) as PushEvent;}catch{throw new APIError('JSON_INVALID');}
 if(event.repository?.full_name!==env.EDITOR_REPOSITORY||!event.ref?.startsWith('refs/heads/content/')||!event.after||!/^[a-f0-9]{40}$/u.test(event.after)||event.deleted)return new Response(null,{status:204});
 const branch=event.ref.slice('refs/heads/'.length),paths=new Set((event.commits??[]).flatMap(commit=>[...(commit.added??[]),...(commit.modified??[]),...(commit.removed??[])]));
 const store=new DraftStore(env.DRAFT_MEDIA,()=>now);
 await store.transact(state=>{for(const draft of Object.values(state.drafts)){
  if(draft.branch!==branch||draft.commit===event.after||draft.state==='deleted')continue;
  // A missing/truncated changed-file list holds all drafts conservatively.
  if(paths.size&&!paths.has(draft.sourcePath??draftPath(draft.contentId)))continue;
  draft.commit=event.after!;draft.lastEditedAt=new Date(now).toISOString();draft.state='active';draft.revision++;delete draft.deleteAfter;delete draft.reviewUntil;store.log(state,'git.activity',draft.id);
 }});
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
