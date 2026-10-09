// One explicitly approved readonly observation; never writes a baseline or enables monitoring.
import {createHash} from 'node:crypto';
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {record,optionalField,readablePageInfo,successfulCloudflareEnvelope,emptySettingsBindings,emptyVersionBindings,completeDomainInventory,domainSetMatches} from './cloudflare-response-shapes.mjs';
import {authority} from './deployment-policy.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';
import {safeSettings,safeScriptSettings,safeVersion,safeSubdomain,safeCandidateEnvelope,validConditionSeed,conditionSeed} from './site-monitor-candidate.mjs';

const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const natural=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>record(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const keys=['configuration','boundedOperation','transport','tokenIdentity','tokenActive','tokenTimes','workerIdentity','deploymentInventory','deploymentIdentity','versionIdentity','settingsBindingsEmpty','versionBindingsEmpty','settingsFingerprint','scriptSettingsFingerprint','versionResourcesFingerprint','endpointFlagsSuppressed','domainInventory','domainOwnership','routeInventory','routesObservedAbsent','accountSubdomain','homeHttp','homeBytes','workersDev404','versionPreview404','alternateNoHomeBytes','snapshotStable'];
class Stop extends Error {}

function validExpected(e){
 return exact(e,['schemaVersion','selection','accountId','credentialId','workerTag','deploymentId','versionId','accountSubdomainSha256','zoneId','settingsSha256','scriptSettingsSha256','versionResourcesSha256','homeSha256'])&&validConditionSeed(conditionSeed(e))&&[e.settingsSha256,e.scriptSettingsSha256,e.versionResourcesSha256,e.accountSubdomainSha256].every(hash);
}

export async function probeMonitorConditions({expected,credentialProvider,fetchImpl,clock=Date.now,signal}={}){
 const checks=Object.fromEntries(keys.map(k=>[k,'NOT_CHECKED']));
 const receipt=pass=>({status:pass?'CONDITIONS_MATCH_NO_LIVE_ACCEPTANCE':'CONDITIONS_BLOCKED',checks:{...checks},deployAllowed:false,acceptance:false,providerMutations:0,baselineUpdated:false,monitorActivated:false,routeScopeIndependentlyVerified:false});
 const requireCheck=(key,value)=>{checks[key]=value?'PASS':'FAIL';if(!value)throw new Stop()};
 let timer,abort;
 const controller=new AbortController();
 try{
  requireCheck('configuration',validExpected(expected)&&typeof credentialProvider==='function'&&typeof fetchImpl==='function'&&typeof clock==='function'&&(signal===undefined||signal instanceof AbortSignal));
  const e=structuredClone(expected),started=clock(),deadlineAt=started+120000;
  const operation=()=>{const now=clock();requireCheck('boundedOperation',Number.isFinite(started)&&Number.isFinite(now)&&now>=started&&now<deadlineAt&&!controller.signal.aborted&&!signal?.aborted);return now};
  abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(abort,120000);operation();
  const account='/client/v4/accounts/'+e.accountId,script=account+'/workers/scripts/'+authority.worker,route='/client/v4/zones/'+e.zoneId+'/workers/routes';
  const singles=new Set([account+'/tokens/verify',account+'/workers/scripts',script+'/versions/'+e.versionId,script+'/settings',script+'/script-settings',script+'/subdomain',account+'/workers/domains',account+'/workers/subdomain',route]);
  let credentialPromise,requests=0;
  const fixedCredential=context=>credentialPromise??=Promise.resolve().then(()=>credentialProvider(context));
  const request=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider:fixedCredential,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>{
   if(method!=='GET'||body!==undefined||allow404)return false;
   if(singles.has(path))return query.size===0;
   return path===script+'/deployments'&&query.size===2&&query.get('per_page')==='100'&&query.has('page')&&/^[1-8]$/.test(query.get('page'));
  }});
  async function read(path,key,endpoint){
   operation();requireCheck('boundedOperation',requests<32);requests++;
   const r=await request({path,signal:controller.signal,deadlineAt});operation();checks.transport='PASS';
   requireCheck(key,r.status===200&&successfulCloudflareEnvelope(r.data,endpoint)&&Object.hasOwn(r.data,'result')&&(![account+'/tokens/verify',script+'/settings',script+'/script-settings',script+'/versions/'+e.versionId,account+'/workers/subdomain'].includes(path)||safeCandidateEnvelope(r.data)));
   return r.data;
  }
  async function token(){
   const v=(await read(account+'/tokens/verify','tokenIdentity')).result;
   requireCheck('tokenIdentity',record(v)&&v.id===e.credentialId);
   requireCheck('tokenActive',v.status==='active');
   const now=operation();
   requireCheck('tokenTimes',optionalField(v,'expires_on',x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&Date.parse(x)>now)&&optionalField(v,'not_before',x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&Date.parse(x)<=now));
  }
  function unpaged(b,key){
   const rows=b.result;
   requireCheck(key,Array.isArray(rows)&&rows.every(record)&&readablePageInfo(b,rows,{singlePage:true})&&(!Object.hasOwn(b,'result_info')||b.result_info.count===rows.length&&b.result_info.total_count===rows.length));
   return rows;
  }
  async function identities(){
   const rows=unpaged(await read(account+'/workers/scripts','workerIdentity'),'workerIdentity'),target=rows.filter(r=>r.id===authority.worker),tags=rows.filter(r=>r.tag===e.workerTag);
   requireCheck('workerIdentity',target.length===1&&target[0].tag===e.workerTag&&tags.length===1&&tags[0]===target[0]);
   return fingerprint({id:target[0].id,tag:target[0].tag});
  }
  async function deployments(){
   const rows=[],seen=new Set();let total;
   for(let page=1;page<=8;page++){
    const b=await read(script+'/deployments?page='+page+'&per_page=100','deploymentInventory'),items=record(b.result)?b.result.deployments:undefined,i=b.result_info;
    requireCheck('deploymentInventory',Array.isArray(items)&&items.every(record)&&record(i)&&i.page===page&&i.per_page===100&&i.count===items.length&&items.length<=100&&natural(i.total_count)&&i.total_count<=800&&(!Object.hasOwn(i,'total_pages')||Number.isSafeInteger(i.total_pages)&&i.total_pages===Math.max(1,Math.ceil(i.total_count/100))));
    total??=i.total_count;requireCheck('deploymentInventory',total===i.total_count);
    for(const row of items){requireCheck('deploymentInventory',uuid(row.id)&&!seen.has(row.id));seen.add(row.id);rows.push(row)}
    requireCheck('deploymentInventory',rows.length<=total);
    if(rows.length===total)return rows;
    requireCheck('deploymentInventory',items.length>0&&page<8);
   }
   throw new Stop();
  }
  async function domains(){
   const b=await read(account+'/workers/domains','domainInventory','account-worker-domains');
   requireCheck('domainInventory',completeDomainInventory(b));
   requireCheck('domainOwnership',domainSetMatches(b.result,authority.worker,authority.hostname));
   return fingerprint(b.result.filter(r=>r.service===authority.worker||r.hostname===authority.hostname));
  }
  async function routes(){
   const rows=unpaged(await read(route,'routeInventory'),'routeInventory'),seen=new Set();
   for(const r of rows){requireCheck('routeInventory',id(r.id)&&!seen.has(r.id)&&typeof r.pattern==='string'&&r.pattern.length>0&&optionalField(r,'script',v=>typeof v==='string'));seen.add(r.id)}
   requireCheck('routesObservedAbsent',!rows.some(r=>r.script===authority.worker));
   return fingerprint(rows.filter(r=>r.script===authority.worker));
  }
  async function settings(){
   const v=(await read(script+'/settings','settingsBindingsEmpty')).result;
   requireCheck('settingsBindingsEmpty',emptySettingsBindings(v));
   requireCheck('settingsFingerprint',safeSettings(v)&&fingerprint(v)===e.settingsSha256);
   const s=(await read(script+'/script-settings','scriptSettingsFingerprint')).result;
   requireCheck('scriptSettingsFingerprint',safeScriptSettings(s)&&fingerprint(s)===e.scriptSettingsSha256);
  }
  async function flags(){
   const v=(await read(script+'/subdomain','endpointFlagsSuppressed')).result;
   requireCheck('endpointFlagsSuppressed',record(v)&&v.enabled===false&&v.previews_enabled===false);
   return fingerprint(v);
  }
  async function publicRead(url,key,status){
   operation();const local=new AbortController(),cancel=()=>local.abort();
   controller.signal.addEventListener('abort',cancel,{once:true});
   let timeout;
   try{
    const work=(async()=>{
     const r=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:local.signal,headers:{'Accept-Encoding':'identity','Cache-Control':'no-cache'}});
     operation();if(local.signal.aborted)throw new Stop();
     requireCheck(key,r.status===status&&!!r.body?.getReader);
     const reader=r.body.getReader(),h=createHash('sha256');let size=0;
     try{for(;;){const {done,value}=await reader.read();operation();if(local.signal.aborted)throw new Stop();if(done)break;size+=value.byteLength;requireCheck(key,size<=1048576);h.update(value)}}finally{reader.releaseLock()}
     return h.digest('hex');
    })();
    return await Promise.race([work,new Promise((_,reject)=>{timeout=setTimeout(()=>{local.abort();checks[key]='FAIL';reject(new Stop())},10000)})]);
   }finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',cancel);local.abort()}
  }
  await token();const beforeIdentity=await identities(),before=await deployments(),active=before[0];
  requireCheck('deploymentIdentity',record(active)&&active.id===e.deploymentId&&active.strategy==='percentage'&&Array.isArray(active.versions)&&active.versions.length===1&&record(active.versions[0])&&active.versions[0].version_id===e.versionId&&active.versions[0].percentage===100);
  const version=(await read(script+'/versions/'+e.versionId,'versionIdentity')).result;
  requireCheck('versionIdentity',record(version)&&version.id===e.versionId);
  requireCheck('versionBindingsEmpty',emptyVersionBindings(version));
  requireCheck('versionResourcesFingerprint',safeVersion(version)&&fingerprint(version.resources)===e.versionResourcesSha256);
  await settings();const beforeFlags=await flags(),beforeDomains=await domains(),beforeRoutes=await routes();
  const subdomain=(await read(account+'/workers/subdomain','accountSubdomain')).result;
  requireCheck('accountSubdomain',safeSubdomain(subdomain)&&fingerprint(subdomain)===e.accountSubdomainSha256);
  requireCheck('homeBytes',await publicRead('https://'+authority.hostname+'/','homeHttp',200)===e.homeSha256);
  const root=authority.worker+'.'+subdomain.subdomain+'.workers.dev';
  const workers=await publicRead('https://'+root+'/','workersDev404',404),preview=await publicRead('https://'+e.versionId.slice(0,8)+'-'+root+'/','versionPreview404',404);
  requireCheck('alternateNoHomeBytes',workers!==e.homeSha256&&preview!==e.homeSha256);
  const after=await deployments();await settings();
  const afterFlags=await flags(),afterDomains=await domains(),afterIdentity=await identities(),afterRoutes=await routes();await token();
  requireCheck('snapshotStable',fingerprint(after)===fingerprint(before)&&afterFlags===beforeFlags&&afterDomains===beforeDomains&&afterIdentity===beforeIdentity&&afterRoutes===beforeRoutes);
  operation();return receipt(true);
 }catch(error){
  if(!(error instanceof Stop)){checks.transport='FAIL';if(controller.signal.aborted||signal?.aborted||transportFailureCode(error)==='REMOTE_TIMEOUT')checks.boundedOperation='FAIL'}
  return receipt(false);
 }finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);controller.abort()}
}
