import {createJsonTransport, transportFailureCode} from './deployment-http.mjs';
import {authority} from './deployment-policy.mjs';
import {persistentPolicy} from './deployment-persistent-policy.mjs';
import {successfulCloudflareEnvelope, emptySettingsBindings, emptyVersionBindings, completeDomainInventory, domainSetMatches, readablePageInfo, dnsLabel} from './cloudflare-response-shapes.mjs';
export class ManualDeployError extends Error {}
export const stop = code => {throw new ManualDeployError(code)};
export const uuid = value => typeof value==='string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const timestamp=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const id=value=>typeof value==='string' && /^[a-f0-9]{32}$/.test(value);
export function validateManualContext(context) {
  const keys=['accountId','tokenPolicy','ownerPolicyReviewed'];
  if (!context || Object.keys(context).sort().join('|')!==[...keys].sort().join('|') || !id(context.accountId) || context.ownerPolicyReviewed!==true) stop('INVALID_MANUAL_CONTEXT');
  const p=context.tokenPolicy;
  if (!p || Object.keys(p).sort().join('|')!=='createdOnUtcDate|issuedOn|reviewSource' || p.reviewSource!=='owner-created-and-saved-token' || !/^\d{4}-\d{2}-\d{2}$/.test(p.createdOnUtcDate) || !Number.isFinite(Date.parse(p.createdOnUtcDate+'T00:00:00Z')) || new Date(p.createdOnUtcDate+'T00:00:00Z').toISOString().slice(0,10)!==p.createdOnUtcDate || p.issuedOn!==null && !timestamp(p.issuedOn)) stop('OWNER_POLICY_PIN_REQUIRED');
  return context;
}
export function createManualProvider({context,readonlyCredential,deployCredential,fetchImpl,clock=Date.now}) {
  context=structuredClone(validateManualContext(context));
  const account='/client/v4/accounts/'+context.accountId, script=account+'/workers/scripts/'+authority.worker;
  let count=0,deployIdentity,readonlyIdentity,workerIdentity,zoneIdentity;
  const allowed=new Set([account+'/tokens/verify',account+'/workers/scripts',script+'/settings',script+'/subdomain',account+'/workers/domains',account+'/workers/subdomain']);
  const requestFor=credentialProvider=>createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>method==='GET' && body===undefined && !allow404 && ((allowed.has(path) || zoneIdentity && path==='/client/v4/zones/'+zoneIdentity+'/workers/routes') && query.size===0 || path===script+'/deployments' && query.get('page')==='1' && query.get('per_page')==='100' && query.size===2 || path.startsWith(script+'/versions/') && uuid(path.slice((script+'/versions/').length)) && query.size===0)});
  const readRequest=requestFor(readonlyCredential);
  const tokenRequest=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider:deployCredential,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>path===account+'/tokens/verify' && query.size===0 && method==='GET' && body===undefined && !allow404});
  async function read(path,request=readRequest,endpoint) {
    if (++count>64) stop('PROVIDER_READ_BUDGET');
    try {
      const r=await request({path});
      if (!successfulCloudflareEnvelope(r.data,endpoint)) stop('PROVIDER_ENVELOPE');
      return r.data;
    } catch (error) {if(error instanceof ManualDeployError)throw error;stop(transportFailureCode(error)||'PROVIDER_READ_FAILED');}
  }
  async function verifyDeployToken() {
    const value=(await read(account+'/tokens/verify',tokenRequest)).result, p=context.tokenPolicy;
    if (!value || !id(value.id) || value.status!=='active' || !timestamp(value.expires_on) || value.not_before!==undefined && (!timestamp(value.not_before) || Date.parse(value.not_before)>clock())) stop('DEPLOY_TOKEN_IDENTITY_OR_TIME');
    const day=86400000, lower=Date.parse(p.createdOnUtcDate+'T00:00:00Z'), issued=p.issuedOn===null?lower:Date.parse(p.issuedOn), expiry=Date.parse(value.expires_on), time=clock();
    if(issued<lower || issued>=lower+day || issued>time || expiry<=issued || expiry-issued>persistentPolicy.maximumLifetimeDays*day || time-issued>=persistentPolicy.rotationDueDays*day || expiry-time<persistentPolicy.minimumRemainingDays*day)stop('DEPLOY_TOKEN_POLICY_OR_ROTATION');
    const identity={tokenId:value.id,expiresOn:value.expires_on,notBefore:value.not_before??null};
    if(value.id===readonlyIdentity || deployIdentity && JSON.stringify(deployIdentity)!==JSON.stringify(identity))stop('DEPLOY_TOKEN_CHANGED');
    deployIdentity??=identity;
    return {...identity,status:'active',createdOnUtcDate:p.createdOnUtcDate,issuedOn:p.issuedOn,lifetimeBasis:p.issuedOn===null?'OWNER_CONFIRMED_UTC_DATE_LOWER_BOUND':'OWNER_EXACT_ISSUED_ON',scopeEvidence:'OWNER_CONFIRMED_SPECIFIED_WORKER_EDITOR',scopeLiveReadback:false,notBeforeEvidence:value.not_before===undefined?'ABSENT_ACTIVE_STATUS':'LIVE_VERIFY'};

  }
  async function snapshot() {
    const started=clock();
    const token=(await read(account+'/tokens/verify')).result;
    if (!token || !id(token.id) || token.status!=='active' || token.id===deployIdentity?.tokenId || readonlyIdentity && token.id!==readonlyIdentity) stop('READONLY_TOKEN_IDENTITY');
    readonlyIdentity??=token.id;
    const scripts=await read(account+'/workers/scripts'), rows=scripts.result;
    if (!Array.isArray(rows) || !readablePageInfo(scripts,rows,{singlePage:true}))stop('WORKER_IDENTITY');
    const target=rows.filter(r=>r?.id===authority.worker);
    if(target.length!==1 || !id(target[0].tag) || rows.filter(r=>r?.tag===target[0].tag).length!==1 || workerIdentity && workerIdentity!==target[0].tag)stop('WORKER_IDENTITY');
    workerIdentity??=target[0].tag;

    const settings=(await read(script+'/settings')).result;
    if (!emptySettingsBindings(settings)) stop('BINDINGS_DRIFT');
    const d=await read(script+'/deployments?page=1&per_page=100'), deployments=d.result?.deployments;
    if (!Array.isArray(deployments) || !readablePageInfo(d,deployments,{perPage:100}) || !deployments.length || deployments.length>100 || deployments.some(r=>!uuid(r?.id)) || new Set(deployments.map(r=>r.id)).size!==deployments.length) stop('ACTIVE_DEPLOYMENT_PAGE_UNREADABLE');
    const active=deployments[0];
    if (!uuid(active.id) || active.strategy!=='percentage' || active.versions?.length!==1 || active.versions[0].percentage!==100 || !uuid(active.versions[0].version_id)) stop('ACTIVE_DEPLOYMENT');
    const version=(await read(script+'/versions/'+active.versions[0].version_id)).result;
    if (version?.id!==active.versions[0].version_id || !emptyVersionBindings(version)) stop('VERSION_BINDINGS');
    const flags=(await read(script+'/subdomain')).result;
    if (flags?.enabled!==false || flags?.previews_enabled!==false) stop('ENDPOINT_DRIFT');
    const domains=await read(account+'/workers/domains',readRequest,'account-worker-domains');
    if (!completeDomainInventory(domains) || !domainSetMatches(domains.result,authority.worker,authority.hostname)) stop('DOMAIN_DRIFT');
    const domain=domains.result.find(r=>r.hostname===authority.hostname);
    if(!id(domain.zone_id) || domain.enabled!==true || domain.previews_enabled!==false || zoneIdentity && zoneIdentity!==domain.zone_id)stop('DOMAIN_ZONE_OR_ENDPOINT_DRIFT');
    zoneIdentity??=domain.zone_id;
    const routes=await read('/client/v4/zones/'+zoneIdentity+'/workers/routes');
    if (!Array.isArray(routes.result) || !readablePageInfo(routes,routes.result,{singlePage:true}) || routes.result_info?.count!==routes.result.length || routes.result_info?.total_count!==routes.result.length || routes.result.some(r=>!r || typeof r.id!=='string' || typeof r.pattern!=='string' || r.script===authority.worker)) stop('ROUTE_DRIFT');
    const subdomain=(await read(account+'/workers/subdomain')).result?.subdomain;
    if (!dnsLabel(subdomain)) stop('ACCOUNT_SUBDOMAIN');
    const again=(await read(script+'/deployments?page=1&per_page=100')).result?.deployments?.[0];
    const finalFlags=(await read(script+'/subdomain')).result;
    const finalSettings=(await read(script+'/settings')).result;
    if (JSON.stringify(again)!==JSON.stringify(active) || finalFlags?.enabled!==false || finalFlags?.previews_enabled!==false || !emptySettingsBindings(finalSettings) || clock()-started>120000) stop('PREFLIGHT_CHANGED_OR_STALE');
    return {observedAt:new Date(clock()).toISOString(),deploymentId:active.id,versionId:version.id,accountId:context.accountId,zoneId:zoneIdentity,readonlyTokenId:readonlyIdentity,workerTag:workerIdentity,accountSubdomain:subdomain,bindings:0,routes:0,workersDev:false,previewUrls:false,hostname:authority.hostname};
  }
  return Object.freeze({snapshot,verifyDeployToken});
}