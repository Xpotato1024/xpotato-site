// Read-only, explicitly wired monitor. No ambient credentials, scheduler or writes.
import {createHash} from 'node:crypto';
import {createJsonTransport} from './deployment-http.mjs';
import {record,dnsLabel,emptySettingsBindings,emptyVersionBindings,readablePageInfo,completeDomainInventory,domainSetMatches,successfulCloudflareEnvelope} from './cloudflare-response-shapes.mjs';
import {authority} from './deployment-policy.mjs';
const fail=code=>{throw Error(code)};
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export const fingerprint=v=>createHash('sha256').update(canonical(v)).digest('hex');
const fields=(v,keys)=>{if(!v||Array.isArray(v)||Object.keys(v).sort().join('|')!==keys.sort().join('|'))fail('MONITOR_INVALID_FIELDS')};
export function validateMonitorBaseline(b){
 const v2=b?.schemaVersion===2;
 fields(b,['schemaVersion','status','selection','accountId','workerTag','credentialId','deploymentId','versionId','settingsSha256','scriptSettingsSha256','versionResourcesSha256',v2?'accountSubdomainSha256':'accountSubdomain','zoneIds','samples','checkpointRunId']);
 if(![1,2].includes(b.schemaVersion)||b.status!=='OWNER_APPROVED'||![b.accountId,b.workerTag,b.credentialId].every(id)||![b.deploymentId,b.versionId].every(uuid)||![b.settingsSha256,b.scriptSettingsSha256,b.versionResourcesSha256].every(hash)||!(v2?hash(b.accountSubdomainSha256):dnsLabel(b.accountSubdomain))||b.checkpointRunId!==null&&!/^[1-9][0-9]*$/.test(b.checkpointRunId))fail('MONITOR_BASELINE_UNAPPROVED');
 const s=b.selection;fields(s,['runId','runAttempt','artifactId','sourceSha','digest']);
 if(!/^[1-9][0-9]*$/.test(s.runId)||!Number.isSafeInteger(s.runAttempt)||s.runAttempt<1||!/^[1-9][0-9]*$/.test(s.artifactId)||!/^[a-f0-9]{40}$/.test(s.sourceSha)||!/^sha256:[a-f0-9]{64}$/.test(s.digest))fail('MONITOR_RELEASE_IDENTITY');
 if(!Array.isArray(b.zoneIds)||b.zoneIds.length>1||b.zoneIds.some(z=>!id(z)))fail('MONITOR_ZONE_SCOPE');
 if(!Array.isArray(b.samples)||!b.samples.length||b.samples.length>8||!b.samples.some(s=>s.path==='/'))fail('MONITOR_SAMPLES');
 const paths=new Set();for(const s of b.samples){fields(s,['path','sha256']);if(typeof s.path!=='string'||!/^\/[a-zA-Z0-9/_ .-]*$/.test(s.path)||/[ .]{2}|\s/.test(s.path)||s.path.startsWith('//')||s.path.split('/').includes('..')||!hash(s.sha256)||paths.has(s.path))fail('MONITOR_SAMPLES');paths.add(s.path)}
 return b;
}
function result(r,endpoint){if(r.status!==200||!successfulCloudflareEnvelope(r.data,endpoint)||r.data.result===undefined)fail('MONITOR_API_UNKNOWN');return r.data.result}
export function createIntegrityMonitor({baseline,credentialProvider,fetchImpl,clock=Date.now}){
 // Clone before asynchronous IO: a caller cannot change the approved baseline.
 const b=structuredClone(validateMonitorBaseline(baseline));
 if(typeof clock!=='function'||typeof fetchImpl!=='function'||typeof credentialProvider!=='function')fail('MONITOR_CONFIGURATION');
 const account=`/client/v4/accounts/${b.accountId}`,script=`${account}/workers/scripts/${authority.worker}`;
 const singles=new Set([`${account}/tokens/verify`,`${account}/workers/scripts`,`${account}/workers/subdomain`,`${script}/settings`,`${script}/script-settings`,`${script}/subdomain`,`${script}/versions/${b.versionId}`,...b.zoneIds.map(z=>`/client/v4/zones/${z}/workers/routes`)]);
 let operation,attempted=false,providerGets=0,publicGets=0;
 const checkOperation=()=>{if(operation.signal.aborted||clock()>=operation.deadlineAt)fail('MONITOR_TIMEOUT')};
 // Count dispatched fetches, including failures. No retry or redirect follow.
 const providerFetch=(...args)=>{checkOperation();if(providerGets>=32)fail('MONITOR_GET_LIMIT');providerGets++;return fetchImpl(...args)};
 const receipt=(status,started)=>({status,observedAt:new Date(started).toISOString(),baselineSha256:fingerprint(b),requests:{providerGets,publicGets},deployAllowed:false,providerMutations:0,acceptance:false});
 const rawRequest=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider,fetchImpl:providerFetch,clock,allowRequest:({path,query,method,body,allow404})=>{
  if(method!=='GET'||body!==undefined||allow404)return false;
  if(singles.has(path))return query.size===0;
  if(path===`${account}/workers/domains`)return query.size===0;
  if(path===`${script}/deployments`)return query.size===2&&query.has('page')&&query.get('per_page')==='100'&&/^[1-9][0-9]*$/.test(query.get('page'));
  return false;
 }});
 const request=async args=>{checkOperation();if(providerGets>=32)fail('MONITOR_GET_LIMIT');const r=await rawRequest({...args,...operation});checkOperation();return r};
 async function list(path,extract=v=>v){let total;const rows=[],seen=new Set();for(let page=1;page<=8;page++){
  const r=await request({path:`${path}${path.includes('?')?'&':'?'}page=${page}&per_page=100`}),items=extract(result(r)),info=r.data.result_info;
   if(!Array.isArray(items)||!info||info.page!==page||info.per_page!==100||info.count!==items.length||!Number.isSafeInteger(info.total_count)||info.total_count<0||info.total_count>800||items.length>100||info.total_pages!==undefined&&info.total_pages!==Math.max(1,Math.ceil(info.total_count/100)))fail('MONITOR_PAGINATION_UNKNOWN');
  total??=info.total_count;if(total!==info.total_count)fail('MONITOR_INVENTORY_CHANGED');
  for(const item of items){if(typeof item.id!=='string'||seen.has(item.id))fail('MONITOR_DUPLICATE_ID');seen.add(item.id);rows.push(item)}
  if(rows.length===total)return rows;if(!items.length||rows.length>total)fail('MONITOR_PAGINATION_UNKNOWN');
 }fail('MONITOR_PAGINATION_LIMIT')}
 function unpaged(r){const rows=result(r),i=r.data.result_info;if(!Array.isArray(rows)||!rows.every(record)||!readablePageInfo(r.data,rows,{singlePage:true})||Object.hasOwn(r.data,'result_info')&&(i.count!==rows.length||i.total_count!==rows.length))fail('MONITOR_UNPAGED_UNKNOWN');return rows}
 function domains(r){result(r,'account-worker-domains');if(!completeDomainInventory(r.data))fail('MONITOR_DOMAIN_INVENTORY_NOT_PROVEN');return r.data.result}
 async function publicRead(url,expectedStatus,expectedHash){const controller=new AbortController(),abort=()=>controller.abort();let timer;try{
   operation.signal.addEventListener('abort',abort,{once:true});checkOperation();if(publicGets>=10)fail('MONITOR_GET_LIMIT');
   await Promise.race([(async()=>{publicGets++;const r=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'Accept-Encoding':'identity','Cache-Control':'no-cache'}});checkOperation();if(controller.signal.aborted||r.status!==expectedStatus||!r.body?.getReader)fail('MONITOR_HTTP_DRIFT');const reader=r.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();checkOperation();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();fail('MONITOR_HTTP_LIMIT')}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}if(controller.signal.aborted)fail('MONITOR_HTTP_TIMEOUT');const digest=createHash('sha256').update(Buffer.concat(chunks)).digest('hex');if(expectedHash&&digest!==expectedHash||!expectedHash&&b.samples.some(s=>s.sha256===digest))fail('MONITOR_HTTP_DRIFT')})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('MONITOR_HTTP_TIMEOUT'))},10000)})]);
 }finally{clearTimeout(timer);operation.signal.removeEventListener('abort',abort);controller.abort()}}
 async function observe(started){try{
  const verified=result(await request({path:`${account}/tokens/verify`}));if(verified.id!==b.credentialId||verified.status!=='active')fail('MONITOR_CREDENTIAL_IDENTITY');
  const identities=unpaged(await request({path:`${account}/workers/scripts`})),matches=identities.filter(w=>w.id===authority.worker);if(matches.length!==1||matches[0].tag!==b.workerTag)fail('MONITOR_WORKER_IDENTITY');
  const deployments=await list(`${script}/deployments`,v=>v.deployments),active=deployments[0];
  if(!active||active.id!==b.deploymentId||active.strategy!=='percentage'||!Array.isArray(active.versions)||active.versions.length!==1||active.versions[0].version_id!==b.versionId||active.versions[0].percentage!==100)fail('MONITOR_DEPLOYMENT_DRIFT');
  const settings=result(await request({path:`${script}/settings`})),scriptSettings=result(await request({path:`${script}/script-settings`})),version=result(await request({path:`${script}/versions/${b.versionId}`}));
  if(!emptySettingsBindings(settings)||!record(scriptSettings)||!emptyVersionBindings(version)||version.id!==b.versionId||fingerprint(settings)!==b.settingsSha256||fingerprint(scriptSettings)!==b.scriptSettingsSha256||fingerprint(version.resources)!==b.versionResourcesSha256)fail('MONITOR_SETTINGS_OR_BINDINGS_DRIFT');
  const flags=result(await request({path:`${script}/subdomain`}));if(flags.enabled!==false||flags.previews_enabled!==false)fail('MONITOR_ENDPOINT_DRIFT');
  const targetDomains=domains(await request({path:`${account}/workers/domains`}));if(!domainSetMatches(targetDomains,authority.worker,authority.hostname))fail('MONITOR_DOMAIN_DRIFT');
  for(const z of b.zoneIds)if(unpaged(await request({path:`/client/v4/zones/${z}/workers/routes`})).some(r=>r.script===authority.worker))fail('MONITOR_ROUTE_DRIFT');
   const subdomain=result(await request({path:`${account}/workers/subdomain`}));if(!record(subdomain)||!dnsLabel(subdomain.subdomain)||(b.schemaVersion===2?fingerprint(subdomain)!==b.accountSubdomainSha256:subdomain.subdomain!==b.accountSubdomain))fail('MONITOR_SUBDOMAIN_DRIFT');
  for(const s of b.samples)await publicRead(`https://${authority.hostname}${s.path}`,200,s.sha256);
   const root=`${authority.worker}.${subdomain.subdomain}.workers.dev`;await publicRead(`https://${root}/`,404);await publicRead(`https://${b.versionId.slice(0,8)}-${root}/`,404);
  // Multi-read stability; no atomic snapshot is claimed.
  const after=await list(`${script}/deployments`,v=>v.deployments);
  if(canonical(after[0])!==canonical(active)||fingerprint(result(await request({path:`${script}/settings`})))!==b.settingsSha256||fingerprint(result(await request({path:`${script}/script-settings`})))!==b.scriptSettingsSha256||canonical(result(await request({path:`${script}/subdomain`})))!==canonical(flags)||clock()-started>120000)fail('MONITOR_SNAPSHOT_CHANGED');
   return receipt('OBSERVED_MATCH',started);
  }catch{return receipt('INCIDENT_OWNER_ACTION_REQUIRED',started)}}
  async function check(){if(attempted)fail('MONITOR_CHECK_ALREADY_ATTEMPTED');attempted=true;const started=clock(),controller=new AbortController();operation=Object.freeze({signal:controller.signal,deadlineAt:started+120000});let timer;try{return await Promise.race([observe(started),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(receipt('INCIDENT_OWNER_ACTION_REQUIRED',started))},120000)})])}finally{clearTimeout(timer);controller.abort()}}
 return Object.freeze({check});
}

// A fresh success cannot clear an older incident. Complete authenticated run
// history since an owner-approved checkpoint is required by every deploy gate.
export function assessMonitorHistory({baseline,runs,totalCount,observedAt},now=Date.now()){
 validateMonitorBaseline(baseline);const stamp=Date.parse(observedAt);
 if(!Number.isFinite(stamp)||stamp>now||now-stamp>120000||!Array.isArray(runs)||!Number.isSafeInteger(totalCount)||totalCount!==runs.length||!runs.length)fail('MONITOR_HISTORY_UNKNOWN');
 const ids=new Set();for(const r of runs){if(!/^[1-9][0-9]*$/.test(String(r.id))||ids.has(String(r.id))||!Number.isSafeInteger(r.runAttempt)||r.runAttempt<1||r.repository!==authority.repository||r.path!=='.github/workflows/site-integrity-monitor.yml'||r.headBranch!=='main'||!['schedule','workflow_dispatch'].includes(r.event)||!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>now)fail('MONITOR_RUN_IDENTITY');ids.add(String(r.id))}
 const ordered=[...runs].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||(BigInt(a.id)<BigInt(b.id)?-1:1)),checkpoint=ordered.findIndex(r=>String(r.id)===baseline.checkpointRunId);
 if(checkpoint<0)fail('MONITOR_CHECKPOINT_MISSING');
 const relevant=ordered.slice(checkpoint),latest=relevant.at(-1);
 for(let i=0;i<relevant.length;i++){const r=relevant[i];if(r.runAttempt!==1||r.status!=='completed'||r.conclusion!=='success'||!Number.isFinite(Date.parse(r.completedAt))||Date.parse(r.completedAt)<Date.parse(r.createdAt)||Date.parse(r.completedAt)>now)fail('MONITOR_INCIDENT_LATCHED');if(i&&Date.parse(r.createdAt)-Date.parse(relevant[i-1].createdAt)>600000)fail('MONITOR_COVERAGE_GAP')}
 if(now-Date.parse(latest.createdAt)>600000)fail('MONITOR_STOPPED_OR_STALE');
 return {status:'MONITOR_GATE_CONSISTENT',deployAllowed:true,acceptance:false};
}

export function assessOwnerRecovery(evidence,now=Date.now()){
 fields(evidence,['baseline','observedAt','owner','incidentRunId','revokedTokenId','expectedTokenId','dashboardRevocationConfirmed','endpointsStopped','knownGoodArtifactVerified','restoredSelection','restoredSettingsConfirmed','restoredBindingsEmpty','restoredEndpointsSuppressed','restoredHttpMatches','freshMonitorMatch','ownerResumeApproved']);
 validateMonitorBaseline(evidence.baseline);
 if(evidence.owner!=='Xpotato1024'||!/^[1-9][0-9]*$/.test(evidence.incidentRunId)||!id(evidence.expectedTokenId)||evidence.revokedTokenId!==evidence.expectedTokenId||!Number.isFinite(Date.parse(evidence.observedAt))||Date.parse(evidence.observedAt)>now||now-Date.parse(evidence.observedAt)>120000)fail('RECOVERY_IDENTITY_OR_FRESHNESS');
 for(const key of ['dashboardRevocationConfirmed','endpointsStopped','knownGoodArtifactVerified','restoredSettingsConfirmed','restoredBindingsEmpty','restoredEndpointsSuppressed','restoredHttpMatches','freshMonitorMatch','ownerResumeApproved'])if(evidence[key]!==true)fail('RECOVERY_INCOMPLETE');
 if(canonical(evidence.restoredSelection)!==canonical(evidence.baseline.selection))fail('RECOVERY_ARTIFACT_IDENTITY');
 return {status:'RECOVERY_EVIDENCE_CONSISTENT',acceptance:false,deployAuthorization:false};
}
