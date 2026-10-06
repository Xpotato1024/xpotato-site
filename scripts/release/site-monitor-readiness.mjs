// Fixed read-only scope probe. No baseline changes, scheduler, recovery or writes.
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
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
  return [script+'/deployments',account+'/workers/domains'].includes(path)?query.size===2&&query.get('page')==='1'&&query.get('per_page')==='100':query.size===0;
 }});
 const deadlineAt=clock()+120000;
 async function read(label,url,check){
  try {const response=await request({path:url,deadlineAt});const body=response.data;
   if(body?.success!==true||!Array.isArray(body.errors)||body.errors.length||!check(body.result))throw Error('PROVIDER_SHAPE_UNKNOWN');
   receipts.push({endpoint:label,status:'READABLE'});return body.result;
  }catch(error){receipts.push({endpoint:label,status:transportFailureCode(error)||'PROVIDER_SHAPE_UNKNOWN'});throw Error('STOP');}
 }
 try {
  const deployments=await read('worker-deployments',script+'/deployments?page=1&per_page=100',v=>object(v)&&Array.isArray(v.deployments)&&v.deployments.length>0&&uuid(v.deployments[0].id)&&v.deployments[0].strategy==='percentage'&&Array.isArray(v.deployments[0].versions)&&v.deployments[0].versions.length===1&&v.deployments[0].versions[0].percentage===100&&uuid(v.deployments[0].versions[0].version_id));
  version=deployments.deployments[0].versions[0].version_id;
  await read('worker-version',script+'/versions/'+version,v=>object(v)&&v.id===version&&object(v.resources)&&object(v.resources.bindings));
  await read('worker-settings',script+'/settings',v=>object(v)&&Array.isArray(v.bindings));
  await read('worker-script-settings',script+'/script-settings',object);
  await read('worker-subdomain',script+'/subdomain',v=>object(v)&&typeof v.enabled==='boolean'&&typeof v.previews_enabled==='boolean');
  await read('account-worker-identities',account+'/workers/scripts',v=>Array.isArray(v)&&v.filter(w=>w.id==='xpotato-site'&&id(w.tag)).length===1);
  await read('account-worker-domains',account+'/workers/domains?page=1&per_page=100',Array.isArray);
  await read('account-worker-subdomain',account+'/workers/subdomain',v=>object(v)&&typeof v.subdomain==='string'&&/^[a-z0-9-]{1,63}$/.test(v.subdomain));
  await read('own-account-token-verify',account+'/tokens/verify',v=>object(v)&&id(v.id)&&v.status==='active');
  return result('REQUIRED_GET_ACCESSIBLE_NO_LIVE_ACCEPTANCE');
 }catch{return result('SCOPE_OR_RESPONSE_BLOCKED');}
}
