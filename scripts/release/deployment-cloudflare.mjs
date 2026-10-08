import {createHash} from 'node:crypto';
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {record,dnsLabel,emptySettingsBindings,emptyVersionBindings,readablePageInfo,completeDomainInventory,domainSetMatches,successfulCloudflareEnvelope} from './cloudflare-response-shapes.mjs';
import {authority,validateProviderSnapshot,validateRevocation} from './deployment-policy.mjs';
import {validatePersistentToken} from './deployment-persistent-policy.mjs';
class AdapterError extends Error {}
const fail=code=>{throw new AdapterError(code)};
const safe=fn=>async(...args)=>{try{return await fn(...args)}catch(error){if(error instanceof AdapterError)throw error;throw new AdapterError(transportFailureCode(error)??'CLOUDFLARE_ADAPTER_FAILED')}};
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const stamp=clock=>new Date(clock()).toISOString();
const canonical=v=>{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'};
function checkedSelector(map,accountId,workerTag){
 let account=false,worker=false;
 function visit(v,depth=0){if(v==='*')return;if(!v||Array.isArray(v)||typeof v!=='object'||depth>3||Object.keys(v).length!==1)fail('REVIEWED_SELECTOR_REQUIRED');const [key]=Object.keys(v);if(key==='__proto__'||key==='constructor'||key==='prototype')fail('REVIEWED_SELECTOR_REQUIRED');if(key!=='*'&&key.includes('*'))fail('REVIEWED_SELECTOR_REQUIRED');account ||= key.includes(accountId);worker ||= key.includes(workerTag);visit(v[key],depth+1)}
 visit(map);if(!account||!worker)fail('REVIEWED_SELECTOR_REQUIRED');
 return canonical(map);
}
function result(response,endpoint){if(response.status!==200||!successfulCloudflareEnvelope(response.data,endpoint)||response.data.result===undefined)fail('CLOUDFLARE_RESPONSE_NOT_SUCCESS');return response.data.result}
function unpaged(response){const rows=result(response);if(!Array.isArray(rows)||!rows.every(record))fail('INVALID_UNPAGED_LIST');const info=response.data.result_info;if(!readablePageInfo(response.data,rows,{singlePage:true})||Object.hasOwn(response.data,'result_info')&&(info.count!==rows.length||info.total_count!==rows.length))fail('INCOMPLETE_UNPAGED_LIST');return rows}

// The provider's exact selector is supplied from a separately reviewed Server
// authority, never invented from a display name or inferred from a deny response.
export function createCloudflareAdapter({accountId,workerTag,tokenId,permissionGroupId,reviewedResourceMap,reviewedIndependentAuthority,role,credentialId,credentialProvider,fetchImpl,authorizeMutation,clock=Date.now}){
 if(![accountId,workerTag,tokenId,permissionGroupId,credentialId].every(id)||!['site-read','audit-read','token-revoke','endpoint-contain'].includes(role)||typeof clock!=='function')fail('INVALID_CLOUDFLARE_CONFIGURATION');
 if(role==='site-read'&&credentialId!==tokenId||role!=='site-read'&&credentialId===tokenId)fail('INDEPENDENT_CREDENTIAL_REQUIRED');
 const selector=checkedSelector(reviewedResourceMap,accountId,workerTag);
 const needsInventory=role==='audit-read'||role==='token-revoke';
 const requiredCapabilities=role==='audit-read'?['account-token-read-all','account-zone-inventory-all','worker-read']:['account-token-write-all'];
 if(needsInventory&&(!reviewedIndependentAuthority||!Array.isArray(reviewedIndependentAuthority.policies)||!reviewedIndependentAuthority.policies.length||!Array.isArray(reviewedIndependentAuthority.capabilities)||!requiredCapabilities.every(c=>reviewedIndependentAuthority.capabilities.includes(c))))fail('INDEPENDENT_REVIEWED_AUTHORITY_REQUIRED');
 const operatorPolicies=needsInventory?canonical(reviewedIndependentAuthority.policies):null;
 let independentVerified=false,mutationAttempted=false;
 const account=`/client/v4/accounts/${accountId}`,script=`${account}/workers/scripts/${authority.worker}`,tokenPath=`${account}/tokens/${tokenId}`;
 const expected={accountId,workerTag,tokenId,permissionGroupId};
 const queryOnly=(query,allowed)=>[...query.keys()].every(k=>allowed.includes(k));
 const request=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>{
  if(method==='DELETE')return role==='token-revoke'&&path===tokenPath&&query.size===0&&body===undefined&&!allow404;
  if(method==='POST')return role==='endpoint-contain'&&path===`${script}/subdomain`&&query.size===0&&!allow404&&canonical(body)==='{"enabled":false,"previews_enabled":false}';
  if(body!==undefined)return false;
  if(allow404)return role==='token-revoke'&&path===tokenPath&&query.size===0;
  if(path===`${account}/tokens/verify`)return query.size===0;
  if(needsInventory&&path===`${account}/tokens/${credentialId}`)return query.size===0;
  if(role==='endpoint-contain')return path===`${script}/subdomain`&&query.size===0;
  if(role==='token-revoke')return path===tokenPath&&query.size===0||path===`${account}/tokens`&&queryOnly(query,['page','per_page','include_expired']);
  if(path===`${script}/subdomain`||path===`${script}/settings`)return query.size===0;
  if(path===`${script}/deployments`)return queryOnly(query,['page','per_page']);
  if(path.startsWith(`${script}/versions/`))return uuid(path.slice(`${script}/versions/`.length))&&query.size===0;
  if(role==='site-read')return false;
  if(path===tokenPath||path===`${account}/workers/scripts`||path===`${account}/workers/subdomain`)return query.size===0;
  if(path===`${account}/workers/domains`)return query.size===0;
  if(path===`${account}/tokens`)return queryOnly(query,['page','per_page','include_expired']);
  if(path==='/client/v4/zones')return queryOnly(query,['account.id','page','per_page'])&&query.get('account.id')===accountId;
  return /^\/client\/v4\/zones\/[a-f0-9]{32}\/workers\/routes$/.test(path)&&query.size===0;
 }});
 const checkOperation=operation=>{if(!operation||Object.keys(operation).some(key=>!['signal','deadlineAt'].includes(key))||operation.signal!==undefined&&!(operation.signal instanceof AbortSignal)||operation.deadlineAt!==undefined&&!Number.isFinite(operation.deadlineAt))fail('INVALID_OPERATION_CONTEXT');if(operation.signal?.aborted||operation.deadlineAt!==undefined&&clock()>=operation.deadlineAt)fail('OPERATION_ABORTED')};
 async function verifyCredential(operation={}){
  checkOperation(operation);const raw=result(await request({path:`${account}/tokens/verify`,...operation}));if(raw.id!==credentialId||raw.status!=='active')fail('CREDENTIAL_IDENTITY_NOT_PROVEN');
  if(needsInventory){
   const details=result(await request({path:`${account}/tokens/${credentialId}`,...operation}));
   const issued=Date.parse(details.issued_on),expiry=Date.parse(details.expires_on);
   if(details.id!==credentialId||details.status!=='active'||canonical(details.policies)!==operatorPolicies||!Number.isFinite(issued)||!Number.isFinite(expiry)||issued>clock()||!independentVerified&&clock()-issued>900000||expiry<=clock()||expiry-issued>86400000||!Number.isFinite(Date.parse(details.not_before))||Date.parse(details.not_before)>clock()||Object.hasOwn(details,'value'))fail('INDEPENDENT_SCOPE_OR_LIFETIME_NOT_PROVEN');
   independentVerified=true;
  }
  return {credentialId:raw.id,status:'active',observedAt:stamp(clock)};
 }
 async function paged(path,perPage=50,extract=v=>v,operation={}){
  const collected=[],seen=new Set();let total;
  for(let page=1;page<=100;page++){
   checkOperation(operation);const response=await request({path:`${path}${path.includes('?')?'&':'?'}page=${page}&per_page=${perPage}`,...operation});
   const rows=extract(result(response)),info=response.data.result_info;
   if(!Array.isArray(rows)||!info||info.page!==page||info.per_page!==perPage||info.count!==rows.length||!Number.isSafeInteger(info.total_count)||info.total_count<0||info.count>perPage||info.total_pages!==undefined&&info.total_pages!==Math.max(1,Math.ceil(info.total_count/perPage)))fail('PAGINATION_NOT_PROVEN');
   total??=info.total_count;if(total!==info.total_count)fail('PAGINATION_CHANGED');
   for(const row of rows){if(typeof row.id!=='string'||seen.has(row.id))fail('PAGINATION_DUPLICATE_OR_INVALID_ID');seen.add(row.id);collected.push(row)}
   if(collected.length===total)return collected;
   if(rows.length===0||collected.length>total)fail('PAGINATION_NOT_PROVEN');
  }
  fail('PAGINATION_LIMIT');
 }
 async function readIdentity(){if(role!=='audit-read')fail('AUDIT_AUTHORITY_REQUIRED');await verifyCredential();const scripts=unpaged(await request({path:`${account}/workers/scripts`}));const matches=scripts.filter(s=>s.id===authority.worker);if(matches.length!==1||matches[0].tag!==workerTag)fail('WORKER_TAG_NOT_PROVEN');return {worker:authority.worker,workerTag}}
 async function readTokenMetadata(){
  if(role!=='audit-read')fail('AUDIT_AUTHORITY_REQUIRED');
  await readIdentity();const raw=result(await request({path:tokenPath}));
  if(['value','token','Authorization','sessionCookie'].some(k=>Object.hasOwn(raw,k))||raw.id!==tokenId||!Array.isArray(raw.policies)||raw.policies.length!==1)fail('RAW_TOKEN_POLICY_REJECTED');
  const policy=raw.policies[0];if(policy.effect!=='allow'||!Array.isArray(policy.permission_groups)||policy.permission_groups.length!==1||policy.permission_groups[0].id!==permissionGroupId||canonical(policy.resources)!==selector)fail('RAW_TOKEN_SELECTOR_MISMATCH');
  const metadata={observedAt:stamp(clock),accountId,tokenId:raw.id,status:raw.status,issuedOn:raw.issued_on,notBefore:raw.not_before,expiresOn:raw.expires_on,policyCount:1,effect:'allow',permissionGroupIds:[permissionGroupId],workerTag,resourceScope:'individual-worker',additionalPolicyCount:0};
  try{validatePersistentToken(metadata,expected,clock())}catch{fail('RAW_TOKEN_POLICY_NOT_VALID')}return metadata;
 }
 async function readProviderSnapshot(probe){
  if(role!=='audit-read'||typeof probe!=='function')fail('AUDIT_AND_DATA_PLANE_REQUIRED');
  const started=clock();await readIdentity();
  const settings=result(await request({path:`${script}/settings`}));if(!emptySettingsBindings(settings))fail('BINDINGS_DRIFT');
  const deployments=await paged(`${script}/deployments`,100,v=>v.deployments);const active=deployments[0];if(!active||!uuid(active.id)||active.strategy!=='percentage'||!Array.isArray(active.versions)||active.versions.length!==1||!uuid(active.versions[0].version_id)||active.versions[0].percentage!==100)fail('ACTIVE_DEPLOYMENT_NOT_PROVEN');
  const version=result(await request({path:`${script}/versions/${active.versions[0].version_id}`}));if(!emptyVersionBindings(version)||version.id!==active.versions[0].version_id)fail('ACTIVE_VERSION_BINDINGS_DRIFT');
  const flags=result(await request({path:`${script}/subdomain`}));if(flags.enabled!==false||flags.previews_enabled!==false)fail('ENDPOINT_FLAGS_DRIFT');
  const domainResponse=await request({path:`${account}/workers/domains`});result(domainResponse,'account-worker-domains');if(!completeDomainInventory(domainResponse.data))fail('DOMAIN_INVENTORY_NOT_PROVEN');const targetDomains=domainResponse.data.result;if(!domainSetMatches(targetDomains,authority.worker,authority.hostname))fail('CUSTOM_DOMAIN_DRIFT');
  const zones=await paged('/client/v4/zones?account.id='+accountId);if(!zones.length)fail('ZONE_INVENTORY_NOT_PROVEN');let routes=[];
  for(const zone of zones){if(!id(zone.id)||zone.account?.id!==accountId)fail('ZONE_ACCOUNT_MISMATCH');routes.push(...unpaged(await request({path:`/client/v4/zones/${zone.id}/workers/routes`})).filter(r=>r.script===authority.worker))}
  if(routes.length!==0)fail('WORKER_ROUTE_DRIFT');
  const subdomain=result(await request({path:`${account}/workers/subdomain`}));if(!record(subdomain)||!dnsLabel(subdomain.subdomain))fail('ACCOUNT_SUBDOMAIN_NOT_PROVEN');
  const dataPlane=await probe({versionId:version.id,accountSubdomain:subdomain.subdomain});
  // Detect provider drift during the multi-read snapshot, not only stale timestamps.
  const after=await paged(`${script}/deployments`,100,v=>v.deployments);const flagsAfter=result(await request({path:`${script}/subdomain`}));const bindingsAfter=result(await request({path:`${script}/settings`}));
  if(canonical(after[0])!==canonical(active)||canonical(flagsAfter)!==canonical(flags)||!emptySettingsBindings(bindingsAfter)||clock()-started>120000)fail('SNAPSHOT_CHANGED_OR_STALE');
  const snapshot={observedAt:new Date(started).toISOString(),complete:true,accountId,worker:authority.worker,workerTag,deploymentId:active.id,versionId:version.id,trafficPercent:100,bindings:[],routes:[],hostname:authority.hostname,workersDev:false,previewUrls:false,publicHealth:dataPlane.publicHealth,alternateEndpoints:dataPlane.alternateEndpoints};
  validateProviderSnapshot(snapshot,expected,clock());return snapshot;
 }
 async function authorization(action,operation){checkOperation(operation);if(mutationAttempted)fail('MUTATION_ALREADY_ATTEMPTED');mutationAttempted=true;if(typeof authorizeMutation!=='function')fail('MUTATION_NOT_AUTHORIZED');let granted=false;try{granted=await authorizeMutation({action,accountId,worker:authority.worker,workerTag,tokenId,...operation})}catch{fail('MUTATION_NOT_AUTHORIZED')}checkOperation(operation);if(granted!==true)fail('MUTATION_NOT_AUTHORIZED');await verifyCredential(operation);checkOperation(operation)}
 async function revokeToken(operation={}){
  if(role!=='token-revoke')fail('INDEPENDENT_REVOKE_AUTHORITY_REQUIRED');
  await authorization('revoke-exact-site-token',operation);
  const before=result(await request({path:tokenPath,...operation}));if(before.id!==tokenId)fail('TOKEN_IDENTITY_BEFORE_REVOKE');
  checkOperation(operation);const deleted=result(await request({path:tokenPath,method:'DELETE',...operation}));if(deleted.id!==tokenId)fail('REVOKE_RECEIPT_MISMATCH');
  const inventory=await paged(`${account}/tokens?include_expired=true`,50,v=>v,operation);const detail=await request({path:tokenPath,allow404:true,...operation});
  const receipt={observedAt:stamp(clock),tokenId,revokeSuccess:true,inventoryComplete:true,inventoryContainsToken:inventory.some(t=>t.id===tokenId),detailStatus:detail.status};validateRevocation(receipt,tokenId,clock());return receipt;
 }
 async function containEndpoints(probe,operation={}){
  if(role!=='endpoint-contain'||typeof probe!=='function')fail('INDEPENDENT_CONTAINMENT_AUTHORITY_REQUIRED');
  await authorization('suppress-site-alternate-endpoints',operation);
  checkOperation(operation);const receipt=result(await request({path:`${script}/subdomain`,method:'POST',body:{enabled:false,previews_enabled:false},...operation}));if(receipt.enabled!==false||receipt.previews_enabled!==false)fail('CONTAINMENT_RECEIPT_MISMATCH');
  const flags=result(await request({path:`${script}/subdomain`,...operation}));const reachability=await probe(operation);checkOperation(operation);if(flags.enabled!==false||flags.previews_enabled!==false||reachability.workersDevStatus!==404||reachability.actualVersionPreviewStatus!==404||reachability.siteContentPresent!==false)fail('CONTAINMENT_NOT_PROVEN');
  return {observedAt:stamp(clock),worker:authority.worker,workersDev:false,previewUrls:false,readbackVerified:true};
 }
 return Object.freeze({verifyCredential:safe(verifyCredential),readTokenMetadata:safe(readTokenMetadata),readProviderSnapshot:safe(readProviderSnapshot),revokeToken:safe(revokeToken),containEndpoints:safe(containEndpoints),selectorFingerprint:createHash('sha256').update(selector).digest('hex')});
}
