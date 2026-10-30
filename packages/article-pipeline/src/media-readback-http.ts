import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import type {MediaReadbackPort} from './media-readback.js';
import type {ObjectRead,Plane} from './publication-contracts.js';

type ReadGrant={plane:'source'|'protected';key:string;url:string;headers:Readonly<Record<string,string>>};
/** Created by trusted Server/operator application code, never article JSON.
 * Provider locator resolution, signing, policy/credential inspection stay with
 * Server. This interface neither creates credentials nor admits a resource.
 */
export interface ServerMediaReadSession{
 readonly authorityRevision:string;
 readonly expiresAt:string;
 readonly privateOrigins:readonly string[];
 readonly objects:readonly {plane:Plane;key:string}[];
 policy:MediaReadbackPort['policy'];
 authorizePrivateRead(plane:'source'|'protected',key:string,signal:AbortSignal):Promise<ReadGrant|null>;
}
const keyPattern=/^(source|media)\/v1\/objects\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.(webp|svg|png|jpg|jpeg|avif)$/u;
const keyInfo=(plane:Plane,key:string)=>{const m=keyPattern.exec(key);if(!['source','public','protected'].includes(plane)||!m||m[2]!==m[3]!.slice(0,2)||m[1]!== (plane==='source'?'source':'media')||(plane==='source'&&!['webp','svg'].includes(m[4]!)))throw Error('MEDIA_READ_KEY_INVALID');return m;};
const privateOrigin=(text:string)=>{try{const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.port||!u.hostname.endsWith('.r2.cloudflarestorage.com'))throw Error();return u.origin;}catch{throw Error('MEDIA_PRIVATE_ORIGIN_INVALID');}};

/** Bounded real HTTP GET implementation. Construction performs no I/O. Only
 * exact listed content-addressed objects may be read; there is no write API.
 * Injected fetch permits local contract tests, not a claim of live acceptance.
 */
export function createServerMediaReadbackPort(input:{session:ServerMediaReadSession;fetcher:typeof fetch;mode:'live'|'test_fixture'}):MediaReadbackPort{
 const session=input.session,expires=Date.parse(session.expiresAt),created=Date.now();
 if(session.authorityRevision!==articleMediaTargets.authority.revision||!Number.isFinite(expires)||expires<=created||expires-created>900000)throw Error('MEDIA_READ_SESSION_INVALID');
 if(!['live','test_fixture'].includes(input.mode)||session.objects.length===0||session.objects.length>512||session.privateOrigins.length>3)throw Error('MEDIA_READ_SESSION_INVALID');
 const origins=new Set(session.privateOrigins.map(privateOrigin)),allowed=new Set<string>();
 for(const o of session.objects){keyInfo(o.plane,o.key);const id=o.plane+':'+o.key;if(allowed.has(id))throw Error('MEDIA_READ_SESSION_DUPLICATE');allowed.add(id);}
 const current=()=>{if(Date.now()>=expires)throw Error('MEDIA_READ_SESSION_EXPIRED');};
 return {mode:input.mode,policy:async signal=>{current();return session.policy(signal);},read:async(plane,key,maxBytes,outerSignal):Promise<ObjectRead>=>{
  const match=keyInfo(plane,key);current();
  if(!allowed.has(plane+':'+key)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>24*1024*1024+1)throw Error('MEDIA_READ_NOT_ADMITTED');
  const timeout=AbortSignal.timeout(10000),signal=outerSignal?AbortSignal.any([outerSignal,timeout]):timeout;
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  const operation=async():Promise<ObjectRead>=>{try{
   let url:string,headers:Readonly<Record<string,string>>={};
   if(plane==='public')url=new URL(key,articleMediaTargets.publicOrigin+'/').href;
   else{
    const grant=await session.authorizePrivateRead(plane,key,signal);current();
    if(!grant||grant.plane!==plane||grant.key!==key)throw Error('MEDIA_PRIVATE_READ_GRANT_INVALID');
    const u=new URL(grant.url);if(u.protocol!=='https:'||u.username||u.password||u.hash||!origins.has(u.origin))throw Error('MEDIA_PRIVATE_READ_GRANT_INVALID');
    url=u.href;headers=grant.headers;
   }
   signal.throwIfAborted();
   const response=await input.fetcher(url,{method:'GET',headers,redirect:'error',signal,credentials:'omit',cache:'no-store'});
   if(response.status!==200||response.redirected||!response.body)return {status:'unknown'};
   const length=response.headers.get('content-length');
   if(length!==null&&(!/^\d+$/u.test(length)||Number(length)>maxBytes))throw Error('MEDIA_READ_BODY_LIMIT');
   reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
   for(;;){signal.throwIfAborted();const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>maxBytes)throw Error('MEDIA_READ_BODY_LIMIT');parts.push(r.value);}
   current();signal.throwIfAborted();
   const policy=await session.policy(signal);current();signal.throwIfAborted();
   if(policy.status!=='found')return {status:'unknown'};
   return {status:'found',object:{bytes:Buffer.concat(parts),contentType:response.headers.get('content-type')??'',cacheControl:response.headers.get('cache-control')??'',
    policySha256:policy.fingerprint,protectedRef:plane==='protected'?'site-protected-v1:sha256:'+match[3]+':'+match[4]:null}};
  }catch{return {status:'unknown'};}finally{await reader?.cancel().catch(()=>{});}};
  let stop:(()=>void)|undefined;
  const aborted=new Promise<ObjectRead>(resolve=>{stop=()=>resolve({status:'unknown'});signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();});
  try{return await Promise.race([operation(),aborted]);}finally{if(stop)signal.removeEventListener('abort',stop);}
 }};
}
