// Offline-importable, one-shot collector. No environment lookup, default fetch,
// body persistence, fingerprint, candidate adoption, or provider mutation.
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';

// Fixed public field-name vocabulary from Cloudflare's version GET, settings
// GET and script list docs. A name at a different path is evidence only; this
// does not expand any validator's schema or policy. Never admit arbitrary names
// by spelling/regex: an innocuous-looking key could itself contain private data.
const publicNames=Object.freeze([
 'id','resources','metadata','number','bindings','script','script_runtime',
 'etag','handlers','last_deployed_from','named_handlers','compatibility_date',
 'compatibility_flags','exports','limits','migration_tag','usage_model',
 'author_email','author_id','created_on','modified_on','hasPreview','source',
 'annotations','cache_options','exports_reconciliation','logpush','migrations',
 'observability','placement','tags','tail_consumers','has_assets','has_modules',
 'routes','tag','placement_mode','placement_status'
]);
const names=new Set(publicNames);
const kinds=Object.freeze(['NULL','ARRAY','OBJECT','STRING','NUMBER','BOOLEAN','OTHER']);
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const type=v=>v===null?'NULL':Array.isArray(v)?'ARRAY':({object:'OBJECT',string:'STRING',number:'NUMBER',boolean:'BOOLEAN'}[typeof v]||'OTHER');
const data=(v,k)=>{const d=record(v)&&Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined};
const own=(v,k)=>record(v)&&Object.hasOwn(v,k);
const jsonObject=v=>record(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{
 const d=Object.getOwnPropertyDescriptor(v,k);return typeof k==='string'&&d.enumerable&&Object.hasOwn(d,'value');
});
const emptyJsonArray=v=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===1&&Object.getOwnPropertyDescriptor(v,'length')?.value===0;
const emptyBindings=v=>emptyJsonArray(v)||jsonObject(v)&&Reflect.ownKeys(v).length===0;
const pageNames=Object.freeze(['page','per_page','count','total_count','total_pages']);
const pageInfo=v=>jsonObject(v)&&Object.keys(v).every(k=>pageNames.includes(k))&&Object.keys(v).every(k=>Number.isSafeInteger(data(v,k))&&data(v,k)>=0&&data(v,k)<=1000000000);
// Do not reuse validators that iterate array entries or invoke property getters.
// All descriptors must pass before fixed values are examined.
const envelope=v=>jsonObject(v)&&Object.keys(v).every(k=>['success','errors','result','messages','result_info'].includes(k))&&own(v,'success')&&data(v,'success')===true&&own(v,'errors')&&emptyJsonArray(data(v,'errors'))&&own(v,'result')&&(!own(v,'messages')||emptyJsonArray(data(v,'messages')))&&(!own(v,'result_info')||pageInfo(data(v,'result_info')));
const authority=()=>({acceptance:false,adopted:false,baselineUpdated:false,monitorActivated:false,deployAllowed:false,providerMutations:0});
const receipt=(status,extra={})=>({status,...extra,...authority()});
const bounded=(v,key,max)=>!own(v,key)?'NOT_CHECKED':typeof data(v,key)==='string'&&Buffer.byteLength(data(v,key),'utf8')<=max?'PASS':'FAIL';
class StructureBlock extends Error {constructor(code,scope){super();this.code=code;this.scope=scope}}

function scope(v,label){
 if(v===undefined)return {state:'MISSING',fields:{},unlistedFields:'NOT_CHECKED',unlistedFieldTypes:[]};
 if(!jsonObject(v))throw new StructureBlock('SCOPE_STRUCTURE_BLOCKED',label);
 const keys=Object.keys(v);if(keys.length>128)throw new StructureBlock('FIELD_BUDGET_BLOCKED',label);
 const fields={},unlistedTypes=new Set();let unlisted=false;
 // Only constants supply output keys; provider keys never become output labels.
 for(const key of publicNames)if(own(v,key))fields[key]=type(data(v,key));
 for(const key of keys)if(!names.has(key)){unlisted=true;unlistedTypes.add(type(data(v,key)));}
 return {state:'OBJECT',fields,unlistedFields:unlisted?'PRESENT_WITHHELD':'ABSENT',unlistedFieldTypes:kinds.filter(k=>unlistedTypes.has(k))};
}

// This inspects only five shallow, fixed scopes. It does not traverse bindings,
// annotations, exports, arrays, errors/messages, or unknown object contents.
export function versionStructureReceipt(body,expectedVersionId){
 try{
  if(!jsonObject(body)||!jsonObject(data(body,'result')))return receipt('ENVELOPE_OR_RESULT_BLOCKED');
  if(!envelope(body))return receipt('ENVELOPE_OR_RESULT_BLOCKED');
  const v=data(body,'result'),resources=data(v,'resources');
  if(data(v,'id')!==expectedVersionId||!uuid(expectedVersionId))return receipt('VERSION_IDENTITY_BLOCKED');
  if(!jsonObject(resources)||!own(resources,'bindings')||!emptyBindings(data(resources,'bindings')))return receipt('RESOURCES_OR_BINDINGS_BLOCKED');
  const script=data(resources,'script');
  const scopes={version:scope(v,'version'),resources:scope(resources,'resources'),script:scope(script,'script'),runtime:scope(data(resources,'script_runtime'),'runtime'),metadata:scope(data(v,'metadata'),'metadata')};
  const checks={etagWithin256:bounded(script,'etag',256),deploySourceWithin256:bounded(script,'last_deployed_from',256),authorIdWithin128:bounded(data(v,'metadata'),'author_id',128)};
  const partial=Object.values(scopes).some(s=>s.unlistedFields==='PRESENT_WITHHELD');
  const r=receipt(partial?'STRUCTURE_PARTIAL_UNLISTED_FIELDS':'STRUCTURE_OBSERVED_NO_ACCEPTANCE',{scopes,checks});
  return Buffer.byteLength(JSON.stringify(r),'utf8')<=8192?r:receipt('RECEIPT_BUDGET_BLOCKED');
 }catch(error){return error instanceof StructureBlock?receipt(error.code,{blockedScope:error.scope}):receipt('STRUCTURE_INSPECTION_BLOCKED');}
}

// Single use per wired operation, including transport/shape failure. An approved
// host must enforce the owner's one-run budget; making a new factory is no grant.
export function createVersionStructureProbe({accountId,versionId,credentialProvider,fetchImpl,clock=Date.now,signal}={}){
 let attempted=false;
 const valid=id(accountId)&&uuid(versionId)&&typeof credentialProvider==='function'&&typeof fetchImpl==='function'&&typeof clock==='function'&&(signal===undefined||signal instanceof AbortSignal);
 const path=valid?'/client/v4/accounts/'+accountId+'/workers/scripts/xpotato-site/versions/'+versionId:null;
 return Object.freeze({acquire:async()=>{
  if(attempted)return receipt('ALREADY_ATTEMPTED');attempted=true;
  if(!valid)return receipt('CONFIGURATION_BLOCKED');
  try{
   const request=createJsonTransport({origin:'https://api.cloudflare.com',credentialProvider,fetchImpl,clock,allowRequest:args=>args.path===path&&args.query.size===0&&args.method==='GET'&&args.body===undefined&&!args.allow404});
   const deadlineAt=clock()+10000;
   const response=await request({path,signal,deadlineAt});
   if(signal?.aborted||clock()>=deadlineAt)return receipt('TRANSPORT_BLOCKED',{transportCode:'REMOTE_TIMEOUT'});
   return versionStructureReceipt(response.data,versionId);
  }catch(error){return receipt('TRANSPORT_BLOCKED',{transportCode:transportFailureCode(error)||'UNCLASSIFIED'});}
 }});
}
