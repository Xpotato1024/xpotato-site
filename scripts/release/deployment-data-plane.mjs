import {createHash} from 'node:crypto';
import {authority} from './deployment-policy.mjs';
const fail=code=>{throw Error(code)};
export function createDataPlaneProbe({fetchImpl,expectedHomeSha256,siteContentMarkers,timeoutMs=10000}){
 if(typeof fetchImpl!=='function'||!/^[a-f0-9]{64}$/.test(expectedHomeSha256)||!Array.isArray(siteContentMarkers)||!siteContentMarkers.length||siteContentMarkers.some(m=>typeof m!=='string'||m.length<8||m.length>256)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)fail('INVALID_DATA_PLANE_CONFIGURATION');
 async function read(url){const controller=new AbortController();let timer;
  try {
   const operation=(async()=>{const r=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'Accept-Encoding':'identity','Cache-Control':'no-cache'}});if(![200,404].includes(r.status))fail('DATA_PLANE_STATUS_UNKNOWN');if(!r.body?.getReader)fail('DATA_PLANE_BODY_UNREADABLE');const reader=r.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();fail('DATA_PLANE_BODY_LIMIT')}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}return {status:r.status,bytes:Buffer.concat(chunks)}})();
   return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DATA_PLANE_TIMEOUT'))},timeoutMs)})]);
  }catch{fail('DATA_PLANE_PROBE_FAILED')}finally{clearTimeout(timer);controller.abort()}
 }
 return async({versionId,accountSubdomain})=>{
  if(typeof versionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(versionId)||typeof accountSubdomain!=='string'||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(accountSubdomain))fail('INVALID_DATA_PLANE_IDENTITY');
  const root=`${authority.worker}.${accountSubdomain}.workers.dev`;
  // Same 8-character version prefix as pinned Wrangler 4.136.1.
  const home=await read(`https://${authority.hostname}/`),workers=await read(`https://${root}/`),preview=await read(`https://${versionId.slice(0,8)}-${root}/`);
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const siteContentPresent=[workers,preview].some(r=>hash(r.bytes)===expectedHomeSha256||siteContentMarkers.some(marker=>r.bytes.includes(Buffer.from(marker))));
  return {publicHealth:{status:home.status,bytesMatch:hash(home.bytes)===expectedHomeSha256},alternateEndpoints:{workersDevStatus:workers.status,actualVersionPreviewStatus:preview.status,siteContentPresent}};
 };
}
