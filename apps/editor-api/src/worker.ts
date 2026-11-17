import {acceptGitHubActivity} from './webhook.js';
import {limitedRequestBytes} from './request-body.js';
import {GitRepository,createGitHubTransport,defaultRepository,GitError,downloadReviewArchive} from '@xpotato/editor-core/git';
import {documentHandoff} from '@xpotato/editor-core/draft';
import {quotaState} from '@xpotato/editor-core/policy';
import {APIError,type Environment,type Execution,type Session} from './types.js';
import {configured,session,login,callback,logout,assertOrigin} from './auth.js';
import {DraftStore,safeUUID} from './state.js';
import {createDraftRecord,reserveMedia,uploadMedia,readMedia,editDraftState,collectDraftMedia,reconcileReservations} from './media.js';
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
async function body<T>(request:Request):Promise<T>{if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new APIError('JSON_REQUIRED',415);const buffer=await limitedRequestBytes(request,768*1024);try{return JSON.parse(new TextDecoder().decode(buffer)) as T;}catch{throw new APIError('JSON_INVALID');}}
export interface RuntimePorts {authenticate?:(request:Request,env:Environment,write:boolean)=>Promise<Session>;git?:(session:Session,env:Environment)=>GitRepository;now?:()=>number}
export function createHandler(ports:RuntimePorts={}){
 return async function handle(request:Request,env:Environment):Promise<Response>{
  try{
   const url=new URL(request.url),route=url.pathname.replace(/^\/editor-api(?=\/|$)/u,'')||'/',write=!['GET','HEAD','OPTIONS'].includes(request.method);
   if(request.method==='OPTIONS'){assertOrigin(request,env);return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':env.EDITOR_ORIGIN,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-CSRF-Token','Vary':'Origin'}});}
   if(route==='/github/activity'&&request.method==='POST')return acceptGitHubActivity(request,env,(ports.now??Date.now)());
   if(route==='/auth/start'&&request.method==='GET')return login(request,env);
   if(route==='/auth/callback'&&request.method==='GET')return callback(request,env);
   if(route==='/session'&&request.method==='GET'){
    try{const current=await (ports.authenticate??session)(request,env,false);return json({authenticated:true,configured:true,user:current.login,csrf:current.csrf,expires:current.expires,repository:env.EDITOR_REPOSITORY||defaultRepository});}catch(error){if(error instanceof APIError&&[401,503].includes(error.status))return json({authenticated:false,configured:configured(env),repository:env.EDITOR_REPOSITORY||defaultRepository});throw error;}
   }
   const current=await (ports.authenticate??session)(request,env,write);
   if(route==='/auth/logout'&&request.method==='POST')return logout();
   const repository=ports.git?.(current,env)??new GitRepository(createGitHubTransport(current.token,env.EDITOR_REPOSITORY||defaultRepository),env.EDITOR_REPOSITORY||defaultRepository);
   if(route==='/branches'&&request.method==='GET')return json(await repository.branches());
   if(route==='/snapshot'&&request.method==='GET')return json(await repository.snapshot(url.searchParams.get('branch')??'main'));
   const snapshot={branch:url.searchParams.get('branch')??'main',commit:url.searchParams.get('commit')??''};
   if(route==='/manifest'&&request.method==='GET')return json(await repository.manifest(snapshot));
   if(route==='/documents'&&request.method==='GET')return json(await repository.documents(snapshot));
   if(route==='/document'&&request.method==='GET')return json(await repository.read(snapshot,url.searchParams.get('path')??''));
   if(route==='/branch'&&request.method==='POST'){const input=await body<{source:{branch:string;commit:string};target:string}>(request);return json(await repository.createBranch(input.source,input.target),201);}
   if(route==='/save'&&request.method==='POST')return json(await repository.save(await body<Parameters<GitRepository['save']>[0]>(request)));
   if(route==='/pull-request'&&request.method==='POST')return json(await repository.pullRequest(await body<Parameters<GitRepository['pullRequest']>[0]>(request)),201);
   if((route==='/review'||route==='/review/archive')&&request.method==='GET'){
    const result=await repository.reviewArtifact(snapshot.commit,url.searchParams.get('contentId')??'');
    if(route==='/review')return json(result);
    if(!result.ready||!result.artifactId)throw new APIError('EDITOR_REVIEW_NOT_READY',409);
    return downloadReviewArchive(current.token,repository.repository,result.artifactId);
   }
   if(route==='/checks'&&request.method==='GET')return json(await repository.checks(snapshot.commit));
   if(route==='/handoff'&&request.method==='POST'){const input=await body<{snapshot:{branch:string;commit:string};path:string}>(request),doc=await repository.read(input.snapshot,input.path);return json(documentHandoff(doc.source,doc.snapshot.commit,doc.path));}
   if(!env.DRAFT_MEDIA)throw new APIError('DRAFT_STORAGE_NOT_CONFIGURED',503);
   const store=new DraftStore(env.DRAFT_MEDIA,ports.now??Date.now);
   if(route==='/quota'&&request.method==='GET'){const {state}=await store.read();return json({...quotaState(state.usedBytes,store.reserved(state)),assetCount:Object.keys(state.assets).length});}
   if(route==='/drafts'&&request.method==='GET'){const {state}=await store.read();return json(Object.values(state.drafts).filter(d=>d.state!=='deleted'));}
   if(route==='/drafts'&&request.method==='POST')return json(await createDraftRecord(store,await body<Parameters<typeof createDraftRecord>[1]>(request)),201);
   if(route==='/draft-state'&&request.method==='POST')return json(await editDraftState(store,await body<Parameters<typeof editDraftState>[1]>(request)));
   if(route==='/draft'&&request.method==='GET'){const id=url.searchParams.get('id');safeUUID(id);const {state}=await store.read(),draft=state.drafts[id];if(!draft||draft.state==='deleted')throw new APIError('DRAFT_NOT_FOUND',404);return json({draft,assets:Object.values(state.assets).filter(a=>a.draftId===id).map(({key,...asset})=>asset)});}
   if(route==='/media/reserve'&&request.method==='POST')return json(await reserveMedia(store,await body<Parameters<typeof reserveMedia>[1]>(request)),201);
   const upload=/^\/media\/upload\/([a-f0-9-]+)$/u.exec(route);if(upload&&request.method==='PUT')return json(await uploadMedia(store,upload[1]!,request),201);
   const image=/^\/media\/([a-f0-9-]+)$/u.exec(route);if(image&&request.method==='GET')return readMedia(store,image[1]!);
   if(route==='/gc/plan'&&request.method==='GET')return json(await collectDraftMedia(store,true));
   return json({error:'NOT_FOUND'},404);
  }catch(error){
   if(error instanceof APIError||error instanceof GitError)return json({error:error.code},error.status);
   const message=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/u.test(error.message)?error.message:'REQUEST_FAILED';
   return json({error:message},message==='REQUEST_FAILED'?500:400);
  }
 };
}
export default {fetch:createHandler(),async scheduled(_controller:unknown,env:Environment,ctx:Execution){
 if(env.GC_ENABLED!=='true'||!env.DRAFT_MEDIA||!env.GITHUB_WEBHOOK_SECRET)return;
 ctx.waitUntil((async()=>{const store=new DraftStore(env.DRAFT_MEDIA);await reconcileReservations(store);await collectDraftMedia(store,false);})());
}};
