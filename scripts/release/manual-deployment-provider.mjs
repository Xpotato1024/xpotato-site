import {createJsonTransport, transportFailureCode} from './deployment-http.mjs';
import {authority} from './deployment-policy.mjs';
import {persistentPolicy} from './deployment-persistent-policy.mjs';
import {successfulCloudflareEnvelope, emptySettingsBindings, emptyVersionBindings, completeDomainInventory, domainSetMatches, readablePageInfo, dnsLabel} from './cloudflare-response-shapes.mjs';
export class ManualDeployError extends Error {}
export const stop = (code,diagnostics) => {const error=new ManualDeployError(code);if(safeDiagnostics.has(diagnostics))error.diagnostics=diagnostics;throw error;};
export const uuid = value => typeof value==='string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const timestamp=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const id=value=>typeof value==='string' && /^[a-f0-9]{32}$/.test(value);

const safeDiagnostics=new WeakSet();
const kind=value=>value===undefined?'absent':value===null?'null':Array.isArray(value)?'array':typeof value;
export function assessDeployTokenVerify(value,policy,now=Date.now()) {
  const result=value!==null&&typeof value==='object'&&!Array.isArray(value)?value:null;
  const fields={
    result:{present:value!==undefined,type:kind(value),valid:result!==null},
    id:{present:result?.id!==undefined,type:kind(result?.id),valid:id(result?.id)},
    status:{present:result?.status!==undefined,type:kind(result?.status),state:['active','disabled','expired'].includes(result?.status)?result.status:'unrecognized'},
    expires_on:{present:result?.expires_on!==undefined,type:kind(result?.expires_on),valid:timestamp(result?.expires_on)},
    not_before:{present:result?.not_before!==undefined,type:kind(result?.not_before),valid:result?.not_before===undefined||timestamp(result.not_before),state:result?.not_before===undefined?'absent':!timestamp(result.not_before)?'invalid':Date.parse(result.not_before)>now?'future':'effective'}
  };
  let code=null,policyState='not_evaluated',policyReason='NOT_EVALUATED',rotationState='not_evaluated';
  const reported=fields.expires_on.present;
  if(!fields.result.valid)code='DEPLOY_TOKEN_RESULT_MISSING_OR_INVALID';
  else if(!fields.id.present)code='DEPLOY_TOKEN_ID_MISSING';
  else if(!fields.id.valid)code='DEPLOY_TOKEN_ID_FORMAT';
  else if(fields.status.state!=='active')code='DEPLOY_TOKEN_NOT_ACTIVE';
  else if(!reported&&policy.acceptUnreportedExpiry!==true)code='DEPLOY_TOKEN_EXPIRY_MISSING';
  else if(reported&&!fields.expires_on.valid)code='DEPLOY_TOKEN_EXPIRY_FORMAT';
  else if(!fields.not_before.valid)code='DEPLOY_TOKEN_NOT_BEFORE_FORMAT';
  else if(fields.not_before.state==='future')code='DEPLOY_TOKEN_NOT_BEFORE_FUTURE';
  else {
    const day=86400000,lower=Date.parse(policy.createdOnUtcDate+'T00:00:00Z'),issued=policy.issuedOn===null?lower:Date.parse(policy.issuedOn),expiry=Date.parse(result.expires_on);
    rotationState=now-issued>=persistentPolicy.rotationDueDays*day?'due_by_confirmed_time_bound':'not_due_by_confirmed_time_bound';
    if(issued<lower||issued>=lower+day)policyReason='CREATED_TIME_OUTSIDE_CONFIRMED_DAY';
    else if(issued>now)policyReason='CREATED_TIME_IN_FUTURE';
    else if(!reported)policyReason='OWNER_ACCEPTED_UNREPORTED_EXPIRY';
    else if(expiry<=now)policyReason='TOKEN_EXPIRED';
    else if(expiry<=issued)policyReason='NONPOSITIVE_LIFETIME';
    else if(expiry-issued>persistentPolicy.maximumLifetimeDays*day)policyReason='MAXIMUM_LIFETIME_EXCEEDED';
    else if(now-issued>=persistentPolicy.rotationDueDays*day)policyReason='ROTATION_DUE';
    else if(expiry-now<persistentPolicy.minimumRemainingDays*day)policyReason='MINIMUM_REMAINING_LIFETIME';
    else policyReason='PASS';
    policyState=policyReason==='PASS'?'passed':policyReason==='OWNER_ACCEPTED_UNREPORTED_EXPIRY'?'unverified_expiry_accepted':'blocked';
    if(policyState==='blocked')code='DEPLOY_TOKEN_POLICY_OR_ROTATION';
  }
  Object.values(fields).forEach(Object.freeze);Object.freeze(fields);
  const diagnostics=Object.freeze({schemaVersion:1,fields,policy:Object.freeze({state:policyState,reasonCode:policyReason,expiryEvidence:reported?'LIVE_VERIFY':'UNREPORTED',lifetimeVerified:policyState==='passed',rotationEnforced:reported&&(policyState==="passed"||policyState==="blocked"),rotationState}),reasonCode:code??(reported?'TOKEN_VERIFY_CHECK_PASSED':'TOKEN_ACTIVE_EXPIRY_UNREPORTED')});
  safeDiagnostics.add(diagnostics);
  return Object.freeze({code,diagnostics});
}
// Endpoint-specific contract: unfiltered zone routes GET is a documented SinglePage.
// Keep optional metadata checks local; domains still require their complete inventory proof.
function routePattern(pattern) {
  if(typeof pattern!=='string'||!pattern||/[\s\\?#\u0000-\u001f\u007f]/.test(pattern))return null;
  const match=/^(?:(https?):\/\/)?([^/]+)(\/.*)?$/.exec(pattern);
  if(!match)return null;
  const host=match[2].toLowerCase(),path=match[3]||'/',suffix=host.startsWith('*')?host.slice(1):host;
  const dns=suffix.startsWith('.')?suffix.slice(1):suffix;
  if(!dns||dns.length>253||!dns.split('.').every(dnsLabel)||suffix.startsWith('.')&&!host.startsWith('*')||path.includes('*')&&path.indexOf('*')!==path.length-1)return null;
  return {host,path,scheme:match[1]||'*'};
}
export function assessZoneWorkerRoutes(body) {
  const object=body!==null&&typeof body==='object'&&!Array.isArray(body)?body:null;
  const rows=object?.result,info=object?.result_info,hasInfo=object!==null&&Object.hasOwn(object,'result_info');
  const checks={envelope:'NOT_EVALUATED',inventory:'NOT_EVALUATED',pageInfo:'NOT_EVALUATED',rows:'NOT_EVALUATED',patterns:'NOT_EVALUATED',uniqueness:'NOT_EVALUATED',siteWorker:'NOT_EVALUATED',siteHostname:'NOT_EVALUATED'};
  let reason='ROUTE_INVENTORY_CHECK_PASSED';
  const reject=(check,code)=>{checks[check]='FAIL';reason=code;};
  if(!successfulCloudflareEnvelope(body)||Object.hasOwn(object,'messages')&&!Array.isArray(object.messages))reject('envelope','ROUTE_ENVELOPE_INVALID');
  else if(Object.keys(object).some(key=>!['success','errors','messages','result','result_info'].includes(key)))reject('envelope','ROUTE_ENVELOPE_UNSUPPORTED_FIELDS');
  else {
    checks.envelope='PASS';
    if(!Array.isArray(rows))reject('inventory','ROUTE_RESULT_MISSING_OR_INVALID');
    else {
      checks.inventory='PASS';
      const known={count:v=>Number.isSafeInteger(v)&&v>=0,total_count:v=>Number.isSafeInteger(v)&&v>=0,page:v=>Number.isSafeInteger(v)&&v>=1,per_page:v=>Number.isSafeInteger(v)&&v>=1,total_pages:v=>Number.isSafeInteger(v)&&v>=1};
      if(hasInfo&&(info===null||typeof info!=='object'||Array.isArray(info)||Object.entries(known).some(([key,valid])=>Object.hasOwn(info,key)&&!valid(info[key]))))reject('pageInfo','ROUTE_PAGE_INFO_MALFORMED');
      else if(hasInfo&&Object.keys(info).some(key=>!Object.hasOwn(known,key)))reject('pageInfo','ROUTE_PAGE_INFO_UNSUPPORTED_FIELDS');
      else if(hasInfo&&(info.page!==undefined&&info.page!==1||info.total_pages!==undefined&&info.total_pages!==1||info.total_count!==undefined&&info.total_count>rows.length||info.per_page!==undefined&&info.per_page<rows.length))reject('pageInfo','ROUTE_PAGE_INFO_INCOMPLETE');
      else if(hasInfo&&(info.count!==undefined&&info.count!==rows.length||info.total_count!==undefined&&info.total_count!==rows.length||!readablePageInfo(body,rows,{singlePage:true})))reject('pageInfo','ROUTE_PAGE_INFO_CONTRADICTORY');
      else {
        checks.pageInfo=hasInfo?'PRESENT_CONSISTENT':'ABSENT_SINGLE_PAGE_CONTRACT';
        if(rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id||row.id.length>32||/[\s\u0000-\u001f\u007f]/.test(row.id)||typeof row.pattern!=='string'||Object.hasOwn(row,'script')&&(typeof row.script!=='string'||/[\s\u0000-\u001f\u007f]/.test(row.script))))reject('rows','ROUTE_ROW_INVALID');
        else {
          checks.rows='PASS';
          const patterns=rows.map(row=>routePattern(row.pattern));
          if(patterns.includes(null))reject('patterns','ROUTE_PATTERN_UNINTERPRETABLE');
          else {
            checks.patterns='PASS';
            if(new Set(rows.map(row=>row.id)).size!==rows.length)reject('uniqueness','ROUTE_ID_DUPLICATE');
            else if(new Set(patterns.map(pattern=>JSON.stringify(pattern))).size!==rows.length)reject('uniqueness','ROUTE_PATTERN_DUPLICATE');
            else {
              checks.uniqueness='PASS';
              if(rows.some(row=>row.script===authority.worker))reject('siteWorker','SITE_WORKER_ROUTE_PRESENT');
              else {
                checks.siteWorker='PASS';
                if(patterns.some(({host})=>host.startsWith('*')?authority.hostname.endsWith(host.slice(1)):host===authority.hostname))reject('siteHostname','SITE_HOSTNAME_ROUTE_OVERLAP');
                else checks.siteHostname='PASS';
              }
            }
          }
        }
      }
    }
  }
  const fields=Object.freeze({result:Object.freeze({present:object!==null&&Object.hasOwn(object,'result'),type:kind(rows)}),result_info:Object.freeze({present:hasInfo,type:kind(info)})});
  const diagnostics=Object.freeze({schemaVersion:1,stage:'ZONE_WORKER_ROUTES',contract:'UNFILTERED_SINGLE_PAGE',fields,checks:Object.freeze(checks),reasonCode:reason});
  safeDiagnostics.add(diagnostics);
  return Object.freeze({code:reason==='ROUTE_INVENTORY_CHECK_PASSED'?null:'ROUTE_DRIFT',diagnostics});
}

export function validateManualContext(context) {
  const keys=['accountId','tokenPolicy','ownerPolicyReviewed'];
  if (!context || Object.keys(context).sort().join('|')!==[...keys].sort().join('|') || !id(context.accountId) || context.ownerPolicyReviewed!==true) stop('INVALID_MANUAL_CONTEXT');
  const p=context.tokenPolicy;
  const policyKeys=p&&Object.keys(p).sort().join('|');
  if (!p || !['createdOnUtcDate|issuedOn|reviewSource','acceptUnreportedExpiry|createdOnUtcDate|issuedOn|reviewSource'].includes(policyKeys) || p.acceptUnreportedExpiry!==undefined&&typeof p.acceptUnreportedExpiry!=='boolean' || p.reviewSource!=='owner-created-and-saved-token' || !/^\d{4}-\d{2}-\d{2}$/.test(p.createdOnUtcDate) || !Number.isFinite(Date.parse(p.createdOnUtcDate+'T00:00:00Z')) || new Date(p.createdOnUtcDate+'T00:00:00Z').toISOString().slice(0,10)!==p.createdOnUtcDate || p.issuedOn!==null && !timestamp(p.issuedOn)) stop('OWNER_POLICY_PIN_REQUIRED');
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
      if(endpoint==='zone-worker-routes'){const assessment=assessZoneWorkerRoutes(r.data);if(assessment.code)stop(assessment.code,assessment.diagnostics);}
      else if (!successfulCloudflareEnvelope(r.data,endpoint)) stop('PROVIDER_ENVELOPE');
      return r.data;
    } catch (error) {if(error instanceof ManualDeployError)throw error;stop(transportFailureCode(error)||'PROVIDER_READ_FAILED');}
  }
  async function verifyDeployToken() {
    const value=(await read(account+'/tokens/verify',tokenRequest)).result, p=context.tokenPolicy;
    const assessment=assessDeployTokenVerify(value,p,clock());
    if(assessment.code)stop(assessment.code,assessment.diagnostics);
    const identity={tokenId:value.id,expiresOn:value.expires_on??null,notBefore:value.not_before??null,expiryEvidence:assessment.diagnostics.policy.expiryEvidence};
    if(value.id===readonlyIdentity || deployIdentity && JSON.stringify(deployIdentity)!==JSON.stringify(identity))stop('DEPLOY_TOKEN_CHANGED');
    deployIdentity??=identity;
    return {...identity,status:'active',createdOnUtcDate:p.createdOnUtcDate,issuedOn:p.issuedOn,lifetimeBasis:identity.expiryEvidence==='UNREPORTED'?'NO_PROVIDER_EXPIRY_EVIDENCE':p.issuedOn===null?'OWNER_CONFIRMED_UTC_DATE_LOWER_BOUND':'OWNER_EXACT_ISSUED_ON',tokenLifetimePolicyVerified:assessment.diagnostics.policy.lifetimeVerified,rotationEnforced:assessment.diagnostics.policy.rotationEnforced,rotationState:assessment.diagnostics.policy.rotationState,scopeEvidence:'OWNER_CONFIRMED_SPECIFIED_WORKER_EDITOR',scopeLiveReadback:false,notBeforeEvidence:value.not_before===undefined?'ABSENT_ACTIVE_STATUS':'LIVE_VERIFY'};

  }

  async function diagnoseDeployToken() {
    try {
      const value=(await read(account+'/tokens/verify',tokenRequest)).result;
      const assessment=assessDeployTokenVerify(value,context.tokenPolicy,clock());
      return {status:assessment.code?'TOKEN_VERIFY_CHECK_BLOCKED':'TOKEN_VERIFY_CHECK_PASSED',code:assessment.code,diagnostics:assessment.diagnostics,deployAllowed:false,deployCount:0,providerWrites:0,scopeLiveReadback:false};
    } catch(error) {
      return {status:'TOKEN_VERIFY_REQUEST_BLOCKED',code:error instanceof ManualDeployError?error.message:'TOKEN_DIAGNOSTIC_REQUEST_FAILED',deployAllowed:false,deployCount:0,providerWrites:0,scopeLiveReadback:false};
    }
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
    await read('/client/v4/zones/'+zoneIdentity+'/workers/routes',readRequest,'zone-worker-routes');
    const subdomain=(await read(account+'/workers/subdomain')).result?.subdomain;
    if (!dnsLabel(subdomain)) stop('ACCOUNT_SUBDOMAIN');
    const again=(await read(script+'/deployments?page=1&per_page=100')).result?.deployments?.[0];
    const finalFlags=(await read(script+'/subdomain')).result;
    const finalSettings=(await read(script+'/settings')).result;
    if (JSON.stringify(again)!==JSON.stringify(active) || finalFlags?.enabled!==false || finalFlags?.previews_enabled!==false || !emptySettingsBindings(finalSettings) || clock()-started>120000) stop('PREFLIGHT_CHANGED_OR_STALE');
    return {observedAt:new Date(clock()).toISOString(),deploymentId:active.id,versionId:version.id,accountId:context.accountId,zoneId:zoneIdentity,readonlyTokenId:readonlyIdentity,workerTag:workerIdentity,accountSubdomain:subdomain,bindings:0,routes:0,workersDev:false,previewUrls:false,hostname:authority.hostname};
  }
  return Object.freeze({snapshot,verifyDeployToken,diagnoseDeployToken});
}
