import {publicObservationBodyLimit} from "./prime-public-target-policy.mjs";
import {assertPublicTargetPlan,publicReadbackPolicy as policy} from './public-readback-policy.mjs';
import {authority} from './deployment-policy.mjs';
import {hashBytes} from './manual-deployment.mjs';
import {stop,uuid} from './manual-deployment-provider.mjs';
import {dnsLabel} from './cloudflare-response-shapes.mjs';
import {parseStaticHeaderRules,headersForPath} from '../static-headers.mjs';
const reports=new WeakMap();
export const publicReadbackReport=error=>reports.get(error);
export function createPublicReadback({fetchImpl,clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  let count=0,observedBytes=0;
  async function read(url,maxBytes=2097152,deadline=Infinity) {
    const fresh=()=>{if(clock()>=deadline)stop('PUBLIC_READBACK_STALE');};
    fresh();
    if(++count>policy.maxReads)stop('PUBLIC_READ_BUDGET');
    const controller=new AbortController();let timer;
    const operation=(async()=>{
      const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'xpotato-site-manual-readback','Cache-Control':'no-cache'}});
      fresh();
      if(![200,404].includes(response.status)||!response.body?.getReader)stop('PUBLIC_HTTP_OR_REDIRECT');
      const reader=response.body.getReader(),chunks=[];let size=0;
      const cancel=()=>{try{Promise.resolve(reader.cancel()).catch(()=>{})}catch{}};
      controller.signal.addEventListener('abort',cancel,{once:true});
      try {for(;;){fresh();if(controller.signal.aborted)stop('PUBLIC_TIMEOUT');const r=await reader.read();fresh();if(r.done)break;size+=r.value.length;observedBytes+=r.value.length;if(size>maxBytes||observedBytes>policy.maxObservedBytes){cancel();stop('PUBLIC_BODY_LIMIT')}chunks.push(Buffer.from(r.value));}}
      finally {controller.signal.removeEventListener('abort',cancel);try{reader.releaseLock()}catch{}}
      if(controller.signal.aborted)stop('PUBLIC_TIMEOUT');
      const headers=Object.fromEntries(['content-security-policy','x-content-type-options','referrer-policy','permissions-policy','cache-control'].map(name=>[name,response.headers.get(name)]));
      return {status:response.status,bytes:size,sha256:hashBytes(Buffer.concat(chunks)),headers};
    })();
    try {return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('PUBLIC_TIMEOUT'));},Math.min(policy.requestMs,deadline-clock()));})]);}
    catch(error) {if(['PUBLIC_READBACK_STALE','PUBLIC_HTTP_OR_REDIRECT','PUBLIC_BODY_LIMIT'].includes(error?.message))throw error;stop('PUBLIC_READ_FAILED');} finally {clearTimeout(timer);controller.abort();}
  }
  async function alternates(image,deadline=Infinity) {
    if(!uuid(image.versionId)||!dnsLabel(image.accountSubdomain))stop('ALTERNATE_IDENTITY');
    const suffix=image.accountSubdomain+'.workers.dev';
    const worker=await read('https://'+authority.worker+'.'+suffix+'/',2097152,deadline);
    const preview=await read('https://'+image.versionId.slice(0,8)+'-'+authority.worker+'.'+suffix+'/',2097152,deadline);
    if(worker.status!==404||preview.status!==404)stop('ALTERNATE_ENDPOINT_LIVE');
    return {workersDevStatus:worker.status,previewStatus:preview.status};
  }
  return Object.freeze({
    async before(image) {const home=await read('https://'+authority.hostname+'/');return {publicStatus:home.status,homeSha256:home.sha256,...await alternates(image)};},
    async published(targets,image,assertSameVersion=async()=>{}) {
      assertPublicTargetPlan(targets.targets);
      if(count+targets.targets.length+2>policy.maxReads)stop('PUBLIC_READ_BUDGET');
      const deadline=clock()+policy.phaseMs;
      const observations=[],rules=targets.headers?parseStaticHeaderRules(targets.headers):[],startedAt=new Date(clock()).toISOString();
      let pending=targets.targets,attempt=0;
      const report=status=>({status,expectedVersionId:image.versionId,startedAt,observedAt:new Date(clock()).toISOString(),attempts:attempt,requests:count,observedBytes,observations});
      try{
        while(pending.length){
          if(attempt>=policy.maxAttempts)stop('PUBLIC_BYTES_MISMATCH');
          attempt++;
          if(attempt>1){
            if(clock()+policy.reobserveMs>=deadline)stop('PUBLIC_READBACK_STALE');
            await wait(policy.reobserveMs);await assertSameVersion();
          }
          const next=[];
          for(const target of pending){
            if(count+1+2>policy.maxReads)stop('PUBLIC_READ_BUDGET');
            const external=target.path.startsWith('https://');
            const current=await read(external?target.path:'https://'+authority.hostname+target.path,publicObservationBodyLimit(target.path,target.bytes),deadline);
            const expectedHeaders=external?{}:headersForPath(target.path,rules);
            const headerKeys=Object.keys(expectedHeaders).filter(name=>Object.hasOwn(current.headers,name)).sort();
            const headerHash=value=>hashBytes(JSON.stringify(headerKeys.map(key=>[key,value[key]??null])));
            const expected={status:200,bytes:target.bytes,sha256:target.sha256,headersSha256:headerHash(expectedHeaders)};
            const actual={status:current.status,bytes:current.bytes,sha256:current.sha256,headersSha256:headerHash(current.headers)};
            const matches=JSON.stringify(expected)===JSON.stringify(actual);
            observations.push({path:target.path,attempt,observedAt:new Date(clock()).toISOString(),expected,actual,matches});
            if(!matches)next.push(target);
          }
          pending=next;
        }
        await assertSameVersion();await alternates(image,deadline);
        return report('verified');
      }catch(error){
        // No body, raw response, credentials, query strings or arbitrary error text.
        if(error&&typeof error==='object')reports.set(error,report('pending'));
        throw error;
      }
    }
  });
}
