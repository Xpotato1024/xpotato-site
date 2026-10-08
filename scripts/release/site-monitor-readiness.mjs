// Fixed read-only scope probe. No baseline changes, scheduler, recovery or writes.
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {readinessDiagnostics} from './site-monitor-readiness-diagnostics.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
export async function probeWorkerMetadata({accountId,credentialProvider,fetchImpl,clock=Date.now}){
 const receipts=[];
 const result=(status)=>({status,receipts,deployAllowed:false,providerMutations:0,acceptance:false,baselineUpdated:false,routesTested:false,completePaginationVerified:false});
 if(!id(accountId))return result('INVALID_ACCOUNT');
 const account='/client/v4/accounts/'+accountId,script=account+'/workers/scripts/xpotato-site';
 let version;
 const allowed=new Set([script+'/deployments',script+'/settings',script+'/script-settings',script+'/subdomain',account+'/workers/scripts',account+'/workers/domains',account+'/workers/subdomain',account+'/tokens/verify']);
 const request=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>{
  if(method!=='GET'||body!==undefined||allow404)return false;
  if(version&&path===script+'/versions/'+version)return query.size===0;
  if(!allowed.has(path))return false;
  if(path===account+'/workers/domains')return query.size===1&&query.get('service')==='xpotato-site';
  return path===script+'/deployments'?query.size===2&&query.get('page')==='1'&&query.get('per_page')==='100':query.size===0;
 }});
 const deadlineAt=clock()+120000;
 async function read(label,url){
  let diagnostics=readinessDiagnostics(label,undefined,version,false);
  try {const response=await request({path:url,deadlineAt});const body=response.data;
   diagnostics=readinessDiagnostics(label,body,version);
   if(!Object.values(diagnostics.checks).every(v=>v==='PASS'))throw Error('PROVIDER_SHAPE_UNKNOWN');
   receipts.push({endpoint:label,status:'READABLE',diagnostics});return body.result;
  }catch(error){receipts.push({endpoint:label,status:transportFailureCode(error)||'PROVIDER_SHAPE_UNKNOWN',diagnostics});throw Error('STOP');}
 }
 try {
  const deployments=await read('worker-deployments',script+'/deployments?page=1&per_page=100');
  version=deployments.deployments[0].versions[0].version_id;
  await read('worker-version',script+'/versions/'+version);
  await read('worker-settings',script+'/settings');
  await read('worker-script-settings',script+'/script-settings');
  await read('worker-subdomain',script+'/subdomain');
  await read('account-worker-identities',account+'/workers/scripts');
  await read('account-worker-domains',account+'/workers/domains?service=xpotato-site');
  await read('account-worker-subdomain',account+'/workers/subdomain');
  await read('own-account-token-verify',account+'/tokens/verify');
  return result('REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');
 }catch{return result('SCOPE_OR_RESPONSE_BLOCKED');}
}
