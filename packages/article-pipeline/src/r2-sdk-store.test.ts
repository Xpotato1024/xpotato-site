import {it,expect} from 'vitest';import {Readable} from 'node:stream';
import {createR2SdkStorage,assertObjectMatches,type PublishObject} from './r2-sdk-store.js';import {sha256} from './canonical.js';
type Request={method:string;headers:Record<string,string>;hostname:string};
const config={schemaVersion:1,accountId:'a'.repeat(32),buckets:{source:'dummy-source',public:'dummy-public',protected:'dummy-protected'},publicOrigin:'https://assets.xpotato.net',
 acceptance:{basis:'owner-reviewed-configuration-v1',revision:'b'.repeat(40),confirmedAt:'2026-10-01T00:00:00Z',sourcePrivate:true,protectedPrivate:true,protectedLock:'site-protected-all-v1:all-prefixes:Indefinite',automaticExpiration:false}};
const credentials={accessKeyId:'inert-unit-access-key',secretAccessKey:'inert-unit-secret'};
function object(plane:PublishObject['plane']='public'){const bytes=Buffer.from('unit image bytes'),h=sha256(bytes);return {plane,key:(plane==='source'?'source':'media')+'/v1/objects/sha256/'+h.slice(0,2)+'/'+h+'.webp',sha256:h,sizeBytes:bytes.length,contentType:'image/webp',cacheControl:plane==='public'?'public, max-age=31536000, immutable':'private, no-store',bytes};}
function response(statusCode:number,body:string,content='application/xml'){return {response:{statusCode,headers:{'content-type':content},body:Readable.from([body])}};}
it('actual SDK performs exactly one conditional PUT on a retryable 503 and never retries an unknown result',async()=>{
 const calls:string[]=[],o=object(),s=createR2SdkStorage(config,credentials,{requestHandler:{handle:async (req:Request)=>{
  calls.push(req.method);if(req.method==='GET')return response(404,'<Error><Code>NoSuchKey</Code><Message>Absent inert key</Message></Error>');
  expect(req.headers['if-none-match']).toBe('*');expect(req.hostname).toBe('a'.repeat(32)+'.r2.cloudflarestorage.com');
  return response(503,'<Error><Code>SlowDown</Code><Message>Unit retryable failure</Message></Error>');
 }}});
 try{await expect(s.putIfAbsent(o)).rejects.toThrow('R2_PUT_UNKNOWN_NO_RETRY');expect(calls).toEqual(['GET','PUT']);}finally{s.close();}
});
it('403 and ambiguous 404 never permit a PUT; malformed keys fail before a request',async()=>{
 for(const [status,code] of [[403,'AccessDenied'],[404,'Unknown']] as const){let puts=0;
  const s=createR2SdkStorage(config,credentials,{requestHandler:{handle:async (req:Request)=>{if(req.method==='PUT')puts++;return response(status,`<Error><Code>${code}</Code></Error>`);}}});
  try{await expect(s.putIfAbsent(object())).rejects.toThrow('R2_READ_UNKNOWN');await expect(s.putIfAbsent({...object(),key:'../wrong'})).rejects.toThrow('NOT_ADMITTED');expect(puts).toBe(0);}finally{s.close();}
 }
});
it('validates full actual bytes and metadata, reuses existing data and treats a different body as conflict',async()=>{
 const o=object();let puts=0;const s=createR2SdkStorage(config,credentials,{requestHandler:{handle:async (req:Request)=>{
  if(req.method==='PUT')puts++;return {response:{statusCode:200,headers:{'content-type':o.contentType,'cache-control':o.cacheControl,'content-length':String(o.sizeBytes)},body:Readable.from([o.bytes])}};
 }}});
 try{expect(await s.putIfAbsent(o)).toBe('reused');expect(puts).toBe(0);expect(()=>assertObjectMatches(o,{status:'found',bytes:Buffer.from('wrong'),contentType:o.contentType,cacheControl:o.cacheControl})).toThrow('MISMATCH');}finally{s.close();}
});
it('public readback never sends credentials or follows redirects and is bounded to the exact approved object',async()=>{
 const o=object(),s=createR2SdkStorage(config,credentials,{fetcher:async(url,options)=>{
  expect(url).toBe(config.publicOrigin+'/'+o.key);expect(options?.redirect).toBe('error');expect(options?.credentials).toBe('omit');expect(options?.headers).toBeUndefined();
  return new Response(o.bytes,{headers:{'content-type':o.contentType,'cache-control':o.cacheControl}});
 }});
 try{assertObjectMatches(o,await s.readPublic(o));await expect(s.readPublic(object('source'))).rejects.toThrow('PUBLIC_OBJECT_REQUIRED');}finally{s.close();}
});
