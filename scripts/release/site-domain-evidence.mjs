// Bounded three-GET evidence only. No baseline, public HTTP, settings or writes.
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {record,optionalField,readablePageInfo,successfulCloudflareEnvelope,completeDomainInventory,domainSetMatches} from './cloudflare-response-shapes.mjs';
import {authority} from './deployment-policy.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
class EvidenceStop extends Error {}
const keys=['configuration','boundedOperation','transport','tokenEnvelope','tokenIdentity','tokenActive','tokenOptionalTimes','workerEnvelope','workerRows','workerIdentity','domainEnvelope','domainInventory','domainOwnership'];
export async function probeDomainEvidence({accountId,expectedCredentialId,expectedWorkerTag,credentialProvider,fetchImpl,clock=Date.now,signal}={}){
 const checks=Object.fromEntries(keys.map(key=>[key,'FAIL']));
 const result=pass=>({status:pass?'DOMAIN_EVIDENCE_MATCH_NO_LIVE_ACCEPTANCE':'DOMAIN_EVIDENCE_BLOCKED',checks,deployAllowed:false,acceptance:false,providerMutations:0,baselineUpdated:false,monitorActivated:false,routesTested:false,publicHttpTested:false,settingsTested:false});
 const requireCheck=(key,value)=>{checks[key]=value?'PASS':'FAIL';if(!value)throw new EvidenceStop()};
 try {
  requireCheck('configuration',[accountId,expectedCredentialId,expectedWorkerTag].every(id)&&typeof credentialProvider==='function'&&typeof fetchImpl==='function'&&typeof clock==='function'&&(signal===undefined||signal instanceof AbortSignal));
  const started=clock(),deadlineAt=started+30000;
  const checkOperation=()=>{const now=clock();requireCheck('boundedOperation',Number.isFinite(started)&&Number.isFinite(now)&&now>=started&&now<deadlineAt&&!signal?.aborted);return now};
  checkOperation();
  const account='/client/v4/accounts/'+accountId;
  const paths=[account+'/tokens/verify',account+'/workers/scripts',account+'/workers/domains'];
  // Freeze the credential before token verification; later GETs use that same value.
  let credentialPromise;
  const fixedCredential=context=>credentialPromise??=Promise.resolve().then(()=>credentialProvider(context));
  const request=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider:fixedCredential,fetchImpl,clock,allowRequest:({path,query,method,body,allow404})=>method==='GET'&&body===undefined&&!allow404&&query.size===0&&paths.includes(path)});
  async function read(path,check,endpoint){
   checkOperation();const response=await request({path,signal,deadlineAt});checkOperation();checks.transport='PASS';
   requireCheck(check,response.status===200&&successfulCloudflareEnvelope(response.data,endpoint)&&Object.hasOwn(response.data,'result'));
   return response.data;
  }
  const verified=(await read(paths[0],'tokenEnvelope')).result;
  requireCheck('tokenIdentity',record(verified)&&Object.hasOwn(verified,'id')&&verified.id===expectedCredentialId);
  requireCheck('tokenActive',verified.status==='active');
  const now=checkOperation();
  requireCheck('tokenOptionalTimes',optionalField(verified,'expires_on',v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)>now)&&optionalField(verified,'not_before',v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now));
  const identities=await read(paths[1],'workerEnvelope'),rows=identities.result;
  requireCheck('workerRows',Array.isArray(rows)&&rows.every(record)&&readablePageInfo(identities,rows,{singlePage:true}));
  const matches=rows.filter(row=>row.id===authority.worker),tags=rows.filter(row=>row.tag===expectedWorkerTag);
  requireCheck('workerIdentity',matches.length===1&&Object.hasOwn(matches[0],'id')&&Object.hasOwn(matches[0],'tag')&&matches[0].tag===expectedWorkerTag&&tags.length===1&&tags[0]===matches[0]);
  const domains=await read(paths[2],'domainEnvelope','account-worker-domains');
  requireCheck('domainInventory',completeDomainInventory(domains));
  requireCheck('domainOwnership',domainSetMatches(domains.result,authority.worker,authority.hostname));
  checkOperation();return result(true);
 }catch(error){
  if(!(error instanceof EvidenceStop)){checks.transport='FAIL';if(signal?.aborted||transportFailureCode(error)==='REMOTE_TIMEOUT')checks.boundedOperation='FAIL'}
  return result(false);
 }
}
