import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('sw-template.js',import.meta.url),'utf8');
const origin='https://example.test',path='/tools/prime-factorizer/';
const body='exact build',csp="default-src 'self'";
const release={version:'a'.repeat(64),entries:[{path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),csp}]};
function setup({corrupt=false,quota=false,badCsp=false,liveWindows=[]}={}){
  const hooks={},store=new Map([['unrelated-cache',new Map()],['xpotato-prime-offline-v1-old',new Map()]]);let unregistered=false,fetches=0;
  const cache=name=>({keys:async()=>[...store.get(name).keys()].map(url=>new Request(url)),put:async(req,res)=>{if(quota)throw Error('quota');store.get(name).set(typeof req==='string'?req:req.url,res);},match:async key=>store.get(name).get(typeof key==='string'?key:key.url)});
  const caches={keys:async()=>[...store.keys()],delete:async name=>store.delete(name),open:async name=>{if(!store.has(name))store.set(name,new Map());return cache(name);}};
  const self={clients:{matchAll:async()=>liveWindows},location:{origin},registration:{unregister:async()=>{unregistered=true;}},addEventListener:(type,callback)=>hooks[type]=callback};
  runInNewContext(source.replace('__PRIME_PWA_RELEASE__',JSON.stringify(release)),{self,caches,crypto:webcrypto,Request,Response,URL,Uint8Array,fetch:async()=>{fetches++;return new Response(corrupt?'wrong build':body,{headers:{'content-security-policy':badCsp?'wrong':csp}});}});
  const event=async type=>{let promise;hooks[type]({waitUntil:p=>promise=p});await promise;};
  const request=async({url=origin+path,mode='navigate',method='GET'}={})=>{let promise;hooks.fetch({request:{url,mode,method},respondWith:p=>promise=p});return promise?await promise:undefined;};
  const status=async()=>{let promise,result;hooks.message({data:'PRIME_OFFLINE_STATUS',ports:[{postMessage:value=>result=value}],waitUntil:p=>promise=p});await promise;return result;};
  return {store,event,request,status,get unregistered(){return unregistered;},get fetches(){return fetches;}};
}
test('install pins all bytes and CSP; activation cleans only old Prime cache',async()=>{
 const s=setup();await s.event('install');assert.equal(s.store.size,3);await s.event('activate');assert.equal(s.store.size,2);assert.ok(s.store.has('unrelated-cache'));
 assert.equal(await (await s.request({url:origin+path+'?private-input=123'})).text(),body);assert.equal(s.fetches,1);
 assert.equal(await s.request({url:origin+'/search/'}),undefined);assert.equal(await s.request({method:'POST'}),undefined);assert.equal(await s.request({url:'https://other.test'+path}),undefined);
});
for(const failure of ['corrupt','quota','badCsp'])test(failure+' fails atomically and leaves old cache intact',async()=>{
 const s=setup({[failure]:true});await assert.rejects(s.event('install'));assert.equal(s.store.size,2);assert.ok(s.store.has('xpotato-prime-offline-v1-old'));
});
test('eviction fails closed and unregisters rather than mixing release bytes',async()=>{
 const s=setup();await s.event('install');s.store.get('xpotato-prime-offline-v1-'+release.version).clear();const r=await s.request();assert.equal(r.status,503);assert.equal(s.fetches,1);assert.equal(s.unregistered,true);
});
test('status never mistakes a registration or an empty cache for complete storage',async()=>{
 const s=setup();assert.equal((await s.status()).complete,false);assert.equal(s.store.size,2);await s.event('install');assert.equal((await s.status()).complete,true);
 s.store.get('xpotato-prime-offline-v1-'+release.version).clear();assert.equal((await s.status()).complete,false);
});
test('prior-registration windows protect their caches from new-registration activation',async()=>{
 const s=setup({liveWindows:[{url:origin+path}]});await s.event('install');await s.event('activate');assert.equal(s.store.size,3);
});
test('A active / B waiting / A reinstall reuses complete A without failed network or quota touching it',async()=>{
 const s=setup({corrupt:true,quota:true});const name='xpotato-prime-offline-v1-'+release.version;
 const cache=new Map([[origin+path,new Response(body,{headers:{'content-security-policy':csp}})]]);s.store.set(name,cache);
 await s.event('install');assert.equal(s.fetches,0);assert.equal(s.store.get(name),cache);assert.equal(await (await s.request()).text(),body);
});
test('failed refill never deletes a preexisting partial same-version cache',async()=>{
 const s=setup({corrupt:true});const name='xpotato-prime-offline-v1-'+release.version;const cache=new Map();s.store.set(name,cache);
 await assert.rejects(s.event('install'));assert.equal(s.store.get(name),cache);
});
test('no forced activation, user-state APIs, unrestricted runtime caching or claims',()=>{
 assert.doesNotMatch(source,/self\.skipWaiting\(|clients\.claim\(|localStorage|sessionStorage|indexedDB/);
 assert.equal((source.match(/cache\.put\(/g)||[]).length,1);
});
