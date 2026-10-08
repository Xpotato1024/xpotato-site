// Shared shape predicates. Readability is distinct from production evidence.
export const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Run 37720787700 safely diagnosed errors:null on a successful domains envelope.
// Accept that explicit marker only for domains with success===true; never infer/coerce absence.
export const validCloudflareErrors=(body,endpoint)=>record(body)&&Object.hasOwn(body,'errors')&&(Array.isArray(body.errors)&&body.errors.length===0||endpoint==='account-worker-domains'&&Object.hasOwn(body,'success')&&body.success===true&&body.errors===null);
export const successfulCloudflareEnvelope=(body,endpoint)=>record(body)&&Object.hasOwn(body,'success')&&body.success===true&&validCloudflareErrors(body,endpoint);
export const dnsLabel=v=>typeof v==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v);
export const bindingList=v=>Array.isArray(v)&&v.every(record);
export const bindingContainer=v=>record(v)||bindingList(v);
export const optionalField=(parent,key,check)=>record(parent)&&(!Object.hasOwn(parent,key)||check(parent[key]));
export const emptySettingsBindings=v=>record(v)&&Object.hasOwn(v,'bindings')&&bindingList(v.bindings)&&v.bindings.length===0;
export const emptyVersionBindings=v=>record(v)&&record(v.resources)&&Object.hasOwn(v.resources,'bindings')&&bindingContainer(v.resources.bindings)&&Object.keys(v.resources.bindings).length===0;
const natural=v=>Number.isSafeInteger(v)&&v>=0;
const positive=v=>Number.isSafeInteger(v)&&v>=1;

// result_info is optional for a readability probe. If present, reject known
// malformed or contradictory metadata, without inferring inventory completeness.
export function readablePageInfo(body,rows,{singlePage=false,perPage}={}){
 if(!record(body)||!Array.isArray(rows))return false;
 if(!Object.hasOwn(body,'result_info'))return true;
 const i=body.result_info;
 if(!record(i)||!optionalField(i,'count',natural)||!optionalField(i,'total_count',natural)||!optionalField(i,'page',positive)||!optionalField(i,'per_page',positive)||!optionalField(i,'total_pages',positive))return false;
 if(Object.hasOwn(i,'page')&&i.page!==1||Object.hasOwn(i,'count')&&i.count!==rows.length||Object.hasOwn(i,'per_page')&&i.per_page<rows.length||Object.hasOwn(i,'total_count')&&i.total_count<rows.length)return false;
 if(perPage!==undefined&&Object.hasOwn(i,'per_page')&&i.per_page!==perPage)return false;
 if(singlePage&&(Object.hasOwn(i,'total_count')&&i.total_count!==rows.length||Object.hasOwn(i,'total_pages')&&i.total_pages!==1))return false;
 if(Object.hasOwn(i,'total_pages')&&Object.hasOwn(i,'total_count')&&Object.hasOwn(i,'per_page')&&i.total_pages!==Math.max(1,Math.ceil(i.total_count/i.per_page)))return false;
 return true;
}

// Call only for the documented unfiltered domains GET, without query parameters.
// SDK SinglePage alone is not complete-inventory evidence. Missing/partial counts
// remain BLOCKED. Validate the whole inventory before checking site ownership.
export function completeDomainInventory(body){
 const rows=record(body)?body.result:undefined,i=record(body)?body.result_info:undefined;
 if(!Array.isArray(rows)||!record(i)||!readablePageInfo(body,rows,{singlePage:true})||i.page!==1||!positive(i.per_page)||i.count!==rows.length||i.total_count!==rows.length||i.total_pages!==1)return false;
 const ids=new Set(),hostnames=new Set();
 for(const row of rows){
  if(!record(row)||!['id','service','hostname','environment'].every(k=>typeof row[k]==='string'&&row[k].length>0))return false;
  const host=row.hostname.toLowerCase().replace(/\.$/,'');
  if(ids.has(row.id)||hostnames.has(host))return false;
  ids.add(row.id);hostnames.add(host);
 }
 return true;
}

// Separate host ownership from the site's domain set. Unrelated Workers' domains
// are valid inventory rows, but cannot own the expected hostname or hide duplicates.
export function domainSetMatches(rows,worker,hostname){
 if(!Array.isArray(rows)||!rows.every(record))return false;
 const owners=rows.filter(row=>row.hostname===hostname),owned=rows.filter(row=>row.service===worker);
 return owners.length===1&&owners[0].service===worker&&owners[0].environment==='production'&&owned.length===1&&owned[0]===owners[0];
}
