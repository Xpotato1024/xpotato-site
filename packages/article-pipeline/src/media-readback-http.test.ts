import {it,expect,vi} from 'vitest';
import {createServerMediaReadbackPort,type ServerMediaReadSession} from './media-readback-http.js';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
const hash='a'.repeat(64),key='media/v1/objects/sha256/aa/'+hash+'.png',source='source/v1/objects/sha256/aa/'+hash+'.webp';
function setup(){
 const policy={status:'found' as const,authorityRevision:articleMediaTargets.authority.revision,observedAt:new Date().toISOString(),fingerprint:'b'.repeat(64),sourcePrivate:true,protectedPrivate:true,protectedIndefiniteLock:true,automaticExpiration:false,writersSeparated:true};
 const grant=vi.fn(async(plane:'source'|'protected',key:string)=>({plane,key,url:'https://account.r2.cloudflarestorage.com/private/'+key,headers:{Authorization:'test-only-not-a-real-credential'}}));
 const session:ServerMediaReadSession={authorityRevision:articleMediaTargets.authority.revision,expiresAt:new Date(Date.now()+60000).toISOString(),privateOrigins:['https://account.r2.cloudflarestorage.com'],objects:[{plane:'source',key:source},{plane:'public',key},{plane:'protected',key}],policy:async()=>policy,authorizePrivateRead:grant};
 const fetcher=vi.fn(async()=>new Response('bytes',{headers:{'content-type':'image/png','cache-control':articleMediaTargets.public.cacheControl}}));
 return {session,grant,fetcher,port:()=>createServerMediaReadbackPort({session,fetcher:fetcher as typeof fetch,mode:'test_fixture'})};
}
it('constructs without I/O and sends only bounded exact GETs, without private credentials on public reads',async()=>{
 const x=setup(),port=x.port();expect(x.fetcher).not.toHaveBeenCalled();expect(x.grant).not.toHaveBeenCalled();
 expect(await port.read('public',key,6)).toMatchObject({status:'found',object:{contentType:'image/png',bytes:Buffer.from('bytes')}});
 const [url,init]=x.fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe(articleMediaTargets.publicOrigin+'/'+key);expect(init).toMatchObject({method:'GET',headers:{},redirect:'error',credentials:'omit'});expect(x.grant).not.toHaveBeenCalled();
 expect(await port.read('protected',key,6)).toMatchObject({status:'found',object:{protectedRef:'site-protected-v1:sha256:'+hash+':png'}});
 await expect(port.read('public',key.replace('aa/','ab/'),6)).rejects.toThrow('MEDIA_READ_KEY_INVALID');
 await expect(port.read('source',source.replace(hash,'c'.repeat(64)).replace('/aa/','/cc/'),6)).rejects.toThrow('MEDIA_READ_NOT_ADMITTED');
});
it('treats denial, absence, redirects, oversized streams and secret-bearing failures as unknown without retry',async()=>{
 for(const response of [new Response('',{status:403}),new Response('',{status:404}),new Response('',{status:302,headers:{location:'https://elsewhere.invalid'}}),new Response('too long')]){
  const x=setup();x.fetcher.mockResolvedValue(response);expect(await x.port().read('public',key,6)).toEqual({status:'unknown'});expect(x.fetcher).toHaveBeenCalledTimes(1);
 }
 const x=setup();x.fetcher.mockRejectedValue(Error('Authorization: private-example'));expect(await x.port().read('protected',key,6)).toEqual({status:'unknown'});
});
it('rejects a replayed grant and never follows a private grant to an unapproved origin',async()=>{
 for(const change of [{key:'another'},{plane:'source'},{url:'https://other.r2.cloudflarestorage.com/object'},{url:'http://127.0.0.1/internal'}]){
  const x=setup();x.grant.mockImplementation(async(p,k)=>({...await setup().grant(p,k),...change}) as any);expect(await x.port().read('protected',key,6)).toEqual({status:'unknown'});expect(x.fetcher).not.toHaveBeenCalled();
 }
});
it('does not expose a malformed private locator in a constructor error',()=>{
 const x=setup();
 try{createServerMediaReadbackPort({session:{...x.session,privateOrigins:['private-input-not-a-url']},fetcher:x.fetcher as typeof fetch,mode:'test_fixture'});throw Error('expected rejection');}catch(error){expect(error).toBeInstanceOf(Error);expect((error as Error).message).toBe('MEDIA_PRIVATE_ORIGIN_INVALID');expect(JSON.stringify(error)).not.toContain('private-input');}
 expect(x.fetcher).not.toHaveBeenCalled();expect(x.grant).not.toHaveBeenCalled();
});
it('cancels a delayed authorization before it can start a later GET',async()=>{
 const x=setup(),c=new AbortController();let finish:((value:any)=>void)|undefined;
 x.grant.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const port=x.port(),result=port.read('protected',key,6,c.signal);c.abort();expect(await result).toEqual({status:'unknown'});
 finish?.({plane:'protected',key,url:'https://account.r2.cloudflarestorage.com/object',headers:{}});await Promise.resolve();expect(x.fetcher).not.toHaveBeenCalled();
});
