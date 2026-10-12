import {record,bindingList,bindingContainer,optionalField,dnsLabel,readablePageInfo,validCloudflareErrors,successfulCloudflareEnvelope} from './cloudflare-response-shapes.mjs';
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const type=v=>v===undefined?'MISSING':v===null?'NULL':Array.isArray(v)?'ARRAY':({object:'OBJECT',string:'STRING',number:'NUMBER',boolean:'BOOLEAN'}[typeof v]||'OTHER');
const field=(parent,key)=>record(parent)&&Object.hasOwn(parent,key)?type(parent[key]):'MISSING';
const verdict=value=>value?'PASS':'FAIL';
const nullable=check=>v=>v===null||check(v);
const strings=v=>Array.isArray(v)&&v.every(v=>typeof v==='string');
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));

// Every output key is fixed in this module. Never copy provider keys, values,
// array lengths, URLs, identities, binding/error text, headers or credentials.
export function readinessDiagnostics(label,body,version,available=true){
 const value=record(body)?body.result:undefined;
 const fields={envelope:type(body),success:field(body,'success'),errors:field(body,'errors'),result:field(body,'result')};
 const checks={
  transport:'PASS',
  envelope:verdict(successfulCloudflareEnvelope(body,label)),
  success:verdict(record(body)&&body.success===true),errors:verdict(validCloudflareErrors(body,label)),
  result:verdict(record(value))
 };
 const pageFields=()=>{
  const info=record(body)?body.result_info:undefined;
  Object.assign(fields,{result_info:field(body,'result_info'),page:field(info,'page'),per_page:field(info,'per_page'),count:field(info,'count'),total_count:field(info,'total_count'),total_pages:field(info,'total_pages')});
 };
 switch(label){
  case 'worker-deployments':{
   const rows=record(value)?value.deployments:undefined,active=Array.isArray(rows)?rows[0]:undefined,versions=record(active)?active.versions:undefined,entry=Array.isArray(versions)?versions[0]:undefined;
   Object.assign(fields,{deployments:field(value,'deployments'),deploymentId:field(active,'id'),strategy:field(active,'strategy'),versions:field(active,'versions'),versionId:field(entry,'version_id'),percentage:field(entry,'percentage')});
   Object.assign(checks,{deployments:verdict(Array.isArray(rows)&&rows.length>0&&record(active)),identity:verdict(record(active)&&uuid(active.id)&&record(entry)&&uuid(entry.version_id)),traffic:verdict(record(active)&&active.strategy==='percentage'&&Array.isArray(versions)&&versions.length===1&&record(entry)&&entry.percentage===100)});
   pageFields();checks.pagination=verdict(readablePageInfo(body,rows,{perPage:100}));
   break;
  }
  case 'worker-version':{
   const resources=record(value)?value.resources:undefined;
   Object.assign(fields,{id:field(value,'id'),resources:field(value,'resources'),bindings:field(resources,'bindings')});
   Object.assign(checks,{identity:verdict(record(value)&&value.id===version),resources:verdict(record(resources)),bindings:verdict(optionalField(resources,'bindings',bindingContainer))});
   break;
  }
  case 'worker-settings':
   fields.bindings=field(value,'bindings');checks.bindings=verdict(optionalField(value,'bindings',bindingList));
   break;
  case 'worker-script-settings':
   Object.assign(fields,{logpush:field(value,'logpush'),observability:field(value,'observability'),tags:field(value,'tags'),tail_consumers:field(value,'tail_consumers')});
   checks.optionalFields=verdict(optionalField(value,'logpush',v=>typeof v==='boolean')&&optionalField(value,'observability',nullable(record))&&optionalField(value,'tags',nullable(strings))&&optionalField(value,'tail_consumers',nullable(bindingList)));
   break;
  case 'worker-subdomain':
   Object.assign(fields,{enabled:field(value,'enabled'),previews_enabled:field(value,'previews_enabled')});
   checks.flags=verdict(record(value)&&typeof value.enabled==='boolean'&&typeof value.previews_enabled==='boolean');
   break;
  case 'account-worker-identities':{
   const rows=Array.isArray(value)?value:[],matches=rows.filter(v=>record(v)&&v.id==='xpotato-site'),target=matches[0];
   fields.id=field(target,'id');fields.tag=field(target,'tag');
   checks.result=verdict(Array.isArray(value));checks.items=verdict(Array.isArray(value)&&value.every(record));checks.identity=verdict(matches.length===1&&id(target.tag));
   pageFields();checks.pagination=verdict(readablePageInfo(body,value,{singlePage:true}));
   break;
  }
  case 'account-worker-domains':{
   const first=Array.isArray(value)?value[0]:undefined,rows=Array.isArray(value)?value:[];
   Object.assign(fields,{id:field(first,'id'),service:field(first,'service'),hostname:field(first,'hostname'),environment:field(first,'environment')});
   checks.result=verdict(Array.isArray(value));checks.items=verdict(Array.isArray(value)&&rows.every(record));
   checks.identity=verdict(Array.isArray(value)&&rows.every(v=>record(v)&&typeof v.id==='string'&&v.id.length>0)&&new Set(rows.map(v=>v?.id)).size===rows.length);
   checks.service=verdict(Array.isArray(value)&&rows.every(v=>record(v)&&typeof v.service==='string'&&v.service.length>0));
   checks.domainFields=verdict(Array.isArray(value)&&rows.every(v=>record(v)&&typeof v.hostname==='string'&&v.hostname.length>0&&typeof v.environment==='string'));
   pageFields();checks.pagination=verdict(readablePageInfo(body,value,{singlePage:true}));
   break;
  }
  case 'account-worker-subdomain':
   fields.subdomain=field(value,'subdomain');checks.dnsLabel=verdict(record(value)&&dnsLabel(value.subdomain));
   break;
  case 'own-account-token-verify':
   Object.assign(fields,{id:field(value,'id'),status:field(value,'status'),expires_on:field(value,'expires_on'),not_before:field(value,'not_before')});
   Object.assign(checks,{identity:verdict(record(value)&&id(value.id)),tokenStatus:verdict(record(value)&&['active','disabled','expired'].includes(value.status)),active:verdict(record(value)&&value.status==='active'),optionalFields:verdict(optionalField(value,'expires_on',timestamp)&&optionalField(value,'not_before',timestamp))});
   break;
  default:throw Error('INVALID_PROBE_ENDPOINT');
 }
 if(!available){
  for(const key of Object.keys(fields))fields[key]='UNAVAILABLE';
  for(const key of Object.keys(checks))checks[key]='NOT_CHECKED';
  checks.transport='FAIL';
 }
 return {fields,checks};
}
